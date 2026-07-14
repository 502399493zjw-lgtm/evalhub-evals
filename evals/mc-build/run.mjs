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
import { parse as parseYaml } from "yaml";

const RUNNER_VERSION = "mc-evidence-packager-1.0.0";
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_MATERIALS = 64;
const MAX_STEPS = 64;
const MAX_EVIDENCE = 16;
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/u;
const SAFE_PATH = /^(?![\\/])(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))[A-Za-z0-9._\-/\\]{1,240}$/u;

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
    fail(
      "Usage: node evals/mc-build/run.mjs submission.json --out output.json [--eval-commit <git-sha>]",
    );
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

function boundedString(value, label, max, min = 1) {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) {
    fail(`${label} must contain ${min}-${max} characters`);
  }
  return value;
}

function validateInput(parsed) {
  assertExactKeys(parsed, ["participant", "trials", "artifact"], "input");
  if (parsed.trials !== 1) fail("trials must be exactly 1 for mc-build");

  assertExactKeys(parsed.participant, ["model", "config"], "participant");
  const modelValidation = DatedModelIdSchema.safeParse(parsed.participant.model);
  if (!modelValidation.success) fail(modelValidation.error.issues[0]?.message ?? "invalid model id");
  if (
    parsed.participant.config !== undefined &&
    (!parsed.participant.config ||
      typeof parsed.participant.config !== "object" ||
      Array.isArray(parsed.participant.config))
  ) {
    fail("participant.config must be an object");
  }

  const artifact = parsed.artifact;
  assertExactKeys(
    artifact,
    ["title", "summary", "coordinates", "materials", "steps", "evidence"],
    "artifact",
  );
  boundedString(artifact.title, "artifact.title", 120);
  boundedString(artifact.summary, "artifact.summary", 2000);
  assertExactKeys(artifact.coordinates, ["dimension", "x", "y", "z"], "artifact.coordinates");
  if (!["overworld", "nether", "end"].includes(artifact.coordinates.dimension)) {
    fail("artifact.coordinates.dimension must be overworld, nether, or end");
  }
  for (const axis of ["x", "y", "z"]) {
    const value = artifact.coordinates[axis];
    if (!Number.isInteger(value) || value < -30_000_000 || value > 30_000_000) {
      fail(`artifact.coordinates.${axis} must be an in-range integer`);
    }
  }

  if (!Array.isArray(artifact.materials) || artifact.materials.length < 1 || artifact.materials.length > MAX_MATERIALS) {
    fail(`artifact.materials must contain 1-${MAX_MATERIALS} entries`);
  }
  for (const [index, material] of artifact.materials.entries()) {
    assertExactKeys(material, ["name", "count"], `artifact.materials[${index}]`);
    boundedString(material.name, `artifact.materials[${index}].name`, 80);
    if (!Number.isInteger(material.count) || material.count < 1 || material.count > 999_999) {
      fail(`artifact.materials[${index}].count must be an integer from 1 through 999999`);
    }
  }

  if (!Array.isArray(artifact.steps) || artifact.steps.length < 1 || artifact.steps.length > MAX_STEPS) {
    fail(`artifact.steps must contain 1-${MAX_STEPS} entries`);
  }
  artifact.steps.forEach((step, index) => boundedString(step, `artifact.steps[${index}]`, 500));

  if (!Array.isArray(artifact.evidence) || artifact.evidence.length < 1 || artifact.evidence.length > MAX_EVIDENCE) {
    fail(`artifact.evidence must contain 1-${MAX_EVIDENCE} entries`);
  }
  for (const [index, evidence] of artifact.evidence.entries()) {
    assertExactKeys(evidence, ["kind", "path", "caption"], `artifact.evidence[${index}]`);
    if (!["screenshot", "world-save", "build-log"].includes(evidence.kind)) {
      fail(`artifact.evidence[${index}].kind is unsupported`);
    }
    if (typeof evidence.path !== "string" || !SAFE_PATH.test(evidence.path)) {
      fail(`artifact.evidence[${index}].path must be a safe relative path`);
    }
    boundedString(evidence.caption, `artifact.evidence[${index}].caption`, 500);
  }
  return parsed;
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
    fail(`invalid JSON input: ${error.message}`);
  }
  const input = validateInput(parsed);
  const artifact = input.artifact;
  const firstScreenshot = artifact.evidence.find((item) => item.kind === "screenshot");
  const showcases = [
    {
      type: "compare",
      task: artifact.title,
      content: artifact.summary,
      expected: "雷电将军主题、生存功能、资源清单、互动机关与可复现证据齐全",
      verdict: "等待作者按公开 rubric 评分。",
    },
    {
      type: "transcript",
      title: "建造步骤",
      turns: artifact.steps.map((step, index) => ({ role: `step-${index + 1}`, content: step })),
    },
    {
      type: "timeline",
      title: "提交证据",
      events: artifact.evidence.map((item, index) => ({ t: `E${index + 1}`, label: item.caption })),
    },
    ...(firstScreenshot
      ? [{ type: "image", src: firstScreenshot.path, caption: firstScreenshot.caption }]
      : []),
  ];
  const resultFile = {
    eval_id: "mc-build",
    ...(evalCommit ? { eval_commit: evalCommit } : {}),
    submission: {
      runner_version: RUNNER_VERSION,
      run_date: new Date().toISOString().slice(0, 10),
    },
    results: [
      {
        participant: input.participant,
        score: null,
        raw_metric: {
          label: "Evidence package",
          value: `${artifact.evidence.length} evidence / ${artifact.steps.length} steps`,
        },
        detail: `${artifact.summary} 坐标：${artifact.coordinates.dimension} (${artifact.coordinates.x}, ${artifact.coordinates.y}, ${artifact.coordinates.z})。等待作者评分。`,
        showcases,
      },
    ],
  };

  const resultValidation = ResultFileSchema.safeParse(resultFile);
  if (!resultValidation.success) fail(`invalid result envelope: ${resultValidation.error.message}`);
  const contextual = validateResultForEval(await loadEvalDefinition(), resultValidation.data);
  if (!contextual.success) fail(`invalid result for eval: ${contextual.error.message}`);
  await atomicWrite(outputPath, `${JSON.stringify(contextual.data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exitCode = 1;
});
