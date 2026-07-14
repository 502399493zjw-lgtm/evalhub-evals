#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { rename, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DatedModelIdSchema,
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { getQuickJS } from "quickjs-emscripten";
import { parse as parseYaml } from "yaml";

const RUNNER_VERSION = "quickjs-wasm-0.32.0";
const EXPECTED_HARNESS = "quickjs-wasm";
const MAX_INPUT_BYTES = 512 * 1024;
const MAX_SOURCE_BYTES = 64 * 1024;
const MAX_RAW_CHARS = 1024;
const MEMORY_LIMIT_BYTES = 16 * 1024 * 1024;
const STACK_LIMIT_BYTES = 512 * 1024;
const EXECUTION_LIMIT_MS = 150;
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/u;
const SCORE_PASS = "evalhub:trusted-scorer:pass:v1";
const SCORE_FAIL = "evalhub:trusted-scorer:fail:v1";

const taskSpecs = [
  {
    id: "c1",
    fnName: "compactKeepFalsy",
    tests: `
      __deepEqual(__candidate([0, false, "", null, undefined, "ok"]), [0, false, "", "ok"]);
      __deepEqual(__candidate([null, "A", undefined, "B"]), ["A", "B"]);
    `,
  },
  {
    id: "c2",
    fnName: "parseRmb",
    tests: `
      __equal(__candidate("¥1,299.50"), 1299.5);
      __equal(__candidate(" 38元 "), 38);
      __equal(__candidate("免费"), null);
    `,
  },
  {
    id: "c3",
    fnName: "mergeIntervals",
    tests: `
      __deepEqual(__candidate([[5, 7], [1, 3], [3, 5], [10, 11]]), [[1, 7], [10, 11]]);
      __deepEqual(__candidate([[2, 4], [8, 9], [4, 8]]), [[2, 9]]);
    `,
  },
  {
    id: "c4",
    fnName: "normalizeTags",
    tests: `
      __deepEqual(__candidate("AI, 评测，ai  工具,,Eval"), ["ai", "评测", "工具", "eval"]);
      __deepEqual(__candidate(["Node", " node ", "测试"]), ["node", "测试"]);
    `,
  },
  {
    id: "c5",
    fnName: "fillTemplate",
    tests: `
      __equal(__candidate("你好 {{ name }}，今天是 {{day}}，{{unknown}}", { name: "小林", day: "周四" }), "你好 小林，今天是 周四，{{unknown}}");
      __equal(__candidate("{{greet}}, {{ name }}", { greet: "早", name: "阿青" }), "早, 阿青");
    `,
  },
  {
    id: "c6",
    fnName: "nextBusinessDay",
    tests: `
      __equal(__candidate("2026-07-10", ["2026-07-13"]), "2026-07-14");
      __equal(__candidate("2026-07-11"), "2026-07-13");
    `,
  },
];

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  let inputPath;
  let outputPath;
  let evalCommit;
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out" || token === "--eval-commit") {
      if (seen.has(token)) fail(`duplicate argument: ${token}`);
      seen.add(token);
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) fail(`missing value for ${token}`);
      index += 1;
      if (token === "--out") outputPath = value;
      else evalCommit = value;
      continue;
    }
    if (token.startsWith("-")) fail(`unknown argument: ${token}`);
    if (inputPath !== undefined) fail(`unexpected positional argument: ${token}`);
    inputPath = token;
  }

  if (!inputPath || !outputPath) {
    fail("Usage: node evals/code-er/run.mjs answers.json --out output.json [--eval-commit <git-sha>]");
  }
  if (evalCommit !== undefined && !COMMIT_PATTERN.test(evalCommit)) {
    fail("--eval-commit must be a 7-40 character lowercase hexadecimal Git commit");
  }
  return { inputPath, outputPath, evalCommit };
}

function assertExactKeys(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${label} has unknown field: ${key}`);
  }
}

function validateInput(parsed) {
  assertExactKeys(parsed, ["participant", "trials", "answers"], "input");
  if (parsed.trials !== 1) fail("trials must be exactly 1 for code-er");

  assertExactKeys(
    parsed.participant,
    ["model", "harness", "harness_version", "config"],
    "participant",
  );
  const modelValidation = DatedModelIdSchema.safeParse(parsed.participant.model);
  if (!modelValidation.success) fail(modelValidation.error.issues[0]?.message ?? "invalid model id");
  if (
    parsed.participant.harness !== EXPECTED_HARNESS ||
    parsed.participant.harness_version !== "0.32.0"
  ) {
    fail(`participant harness must be ${EXPECTED_HARNESS}@0.32.0`);
  }
  if (
    parsed.participant.config !== undefined &&
    (!parsed.participant.config ||
      typeof parsed.participant.config !== "object" ||
      Array.isArray(parsed.participant.config))
  ) {
    fail("participant.config must be an object");
  }

  assertExactKeys(parsed.answers, taskSpecs.map((task) => task.id), "answers");
  for (const task of taskSpecs) {
    const source = parsed.answers[task.id];
    if (typeof source !== "string" || source.trim().length === 0) {
      fail(`answers.${task.id} must be a non-empty JavaScript source string`);
    }
    if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
      fail(`answers.${task.id} exceeds ${MAX_SOURCE_BYTES} bytes`);
    }
  }
  return parsed;
}

function boundedError(value) {
  let message;
  if (value && typeof value === "object") {
    message = value.message ?? value.stack ?? JSON.stringify(value);
  } else {
    message = String(value);
  }
  return String(message ?? "QuickJS execution failed").slice(0, MAX_RAW_CHARS);
}

function buildTrustedHarness(spec) {
  return `
    "use strict";
    (() => {
      const __arrayIsArray = Array.isArray;
      const __objectIs = Object.is;
      const __objectKeys = Object.keys;
      const __hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);
      const __failure = Object.create(null);
      const __MAX_DEPTH = 32;
      const __MAX_NODES = 4096;

      function __same(actual, expected, depth, state) {
        state.nodes += 1;
        if (state.nodes > __MAX_NODES || depth > __MAX_DEPTH) return false;
        if (__objectIs(actual, expected)) return true;

        const expectedIsArray = __arrayIsArray(expected);
        if (expectedIsArray !== __arrayIsArray(actual)) return false;
        if (expected === null || typeof expected !== "object") return false;
        if (actual === null || typeof actual !== "object") return false;
        if (expectedIsArray && actual.length !== expected.length) return false;

        const expectedKeys = __objectKeys(expected);
        const actualKeys = __objectKeys(actual);
        if (actualKeys.length !== expectedKeys.length) return false;
        for (let index = 0; index < expectedKeys.length; index += 1) {
          const key = expectedKeys[index];
          if (!__hasOwn(actual, key)) return false;
          if (!__same(actual[key], expected[key], depth + 1, state)) return false;
        }
        return true;
      }

      function __equal(actual, expected) {
        if (!__same(actual, expected, 0, { nodes: 0 })) throw __failure;
      }
      function __deepEqual(actual, expected) { __equal(actual, expected); }

      return () => {
        try {
          if (typeof ${spec.fnName} !== "function") throw __failure;
          const __candidate = ${spec.fnName};
          ${spec.tests}
          return ${JSON.stringify(SCORE_PASS)};
        } catch (_) {
          return ${JSON.stringify(SCORE_FAIL)};
        }
      };
    })();
  `;
}

function scoreSnippet(QuickJS, source, spec) {
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(STACK_LIMIT_BYTES);
  const deadline = Date.now() + EXECUTION_LIMIT_MS;
  runtime.setInterruptHandler(() => Date.now() >= deadline);
  const context = runtime.newContext();

  try {
    const harnessEvaluation = context.evalCode(buildTrustedHarness(spec), `${spec.id}.harness.js`);
    if (harnessEvaluation.error) {
      harnessEvaluation.error.dispose();
      fail("trusted scorer initialization failed");
    }

    try {
      const evaluated = context.evalCode(source, `${spec.id}.participant.js`);
      if (evaluated.error) {
        evaluated.error.dispose();
        return { task_id: spec.id, score: 0, raw: "participant execution failed" };
      }
      evaluated.value.dispose();

      const scored = context.callFunction(harnessEvaluation.value, context.undefined);
      if (scored.error) {
        scored.error.dispose();
        return { task_id: spec.id, score: 0, raw: "participant execution failed" };
      }
      const dumped = context.dump(scored.value);
      scored.value.dispose();
      if (dumped === SCORE_PASS) {
        return { task_id: spec.id, score: 100, raw: "passed" };
      }
      if (dumped === SCORE_FAIL) {
        return { task_id: spec.id, score: 0, raw: "assertion failed" };
      }
      fail("trusted scorer returned an invalid result");
    } finally {
      harnessEvaluation.value.dispose();
    }
  } finally {
    context.dispose();
    runtime.dispose();
  }
}

async function loadEvalDefinition() {
  const evalPath = fileURLToPath(new URL("./eval.yaml", import.meta.url));
  return EvalDefSchema.parse(parseYaml(await readFile(evalPath, "utf8")));
}

async function atomicWrite(outputPath, contents) {
  const tempPath = path.join(
    path.dirname(outputPath),
    `.${path.basename(outputPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(tempPath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(tempPath, outputPath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function main() {
  const { inputPath, outputPath, evalCommit } = parseArgs(process.argv.slice(2));
  const rawInput = await readFile(inputPath);
  if (rawInput.byteLength > MAX_INPUT_BYTES) fail(`input exceeds ${MAX_INPUT_BYTES} bytes`);

  let parsed;
  try {
    parsed = JSON.parse(rawInput.toString("utf8"));
  } catch (error) {
    fail(`invalid JSON input: ${boundedError(error)}`);
  }
  const input = validateInput(parsed);

  if (process.env.NODE_ENV === "test" && process.env.EVALHUB_TEST_QUICKJS_INIT_FAILURE === "1") {
    fail("simulated QuickJS initialization failure");
  }
  const QuickJS = await getQuickJS();
  const taskResults = taskSpecs.map((spec) => scoreSnippet(QuickJS, input.answers[spec.id], spec));
  const passed = taskResults.filter((task) => task.score === 100).length;
  const score = Math.round((passed / taskSpecs.length) * 100);
  const resultFile = {
    eval_id: "code-er",
    ...(evalCommit ? { eval_commit: evalCommit } : {}),
    submission: {
      runner_version: RUNNER_VERSION,
      run_date: new Date().toISOString().slice(0, 10),
    },
    results: [
      {
        participant: input.participant,
        score,
        raw_metric: { label: "Passed isolated assertions", value: `${passed}/${taskSpecs.length}` },
        detail: "Each answer ran in a fresh limited QuickJS/WASM runtime without host bindings.",
        task_results: taskResults,
      },
    ],
  };

  const resultValidation = ResultFileSchema.safeParse(resultFile);
  if (!resultValidation.success) fail(`invalid result envelope: ${resultValidation.error.message}`);
  const evalDefinition = await loadEvalDefinition();
  const contextual = validateResultForEval(evalDefinition, resultValidation.data);
  if (!contextual.success) fail(`invalid result for eval: ${contextual.error.message}`);

  await atomicWrite(outputPath, `${JSON.stringify(contextual.data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(boundedError(error));
  process.exitCode = 1;
});
