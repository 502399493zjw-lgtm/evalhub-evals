import { createHash } from "node:crypto";
import { readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const EVAL_ID = "e-commercebench";
const TASK_ID = "autonomous-ecommerce-365-day-run";
const RUNNER_VERSION = "e-commercebench/pack-to-result@1.0.0";
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "0c5d352f75a6022049561e4407cbcfc494156c5c";
const REQUIRED_RUNS = 5;
const SIM_DAYS = 365;
const INITIAL_BALANCE_CNY = 100_000;
const MAX_ABS_ASSETS_CNY = 1e12;
const MAX_COUNT = 10_000_000;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const ID_PATTERN = /^[A-Za-z0-9._-]{3,128}$/u;
const MODEL_PATTERN = /^[A-Za-z0-9._/:+-]{2,255}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

const ROOT_KEYS = [
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "upstream_commit",
  "simulation",
  "participant",
  "run_date",
  "runs",
];
const SIM_KEYS = ["days", "initial_balance_cny", "max_stores"];
const PARTICIPANT_KEYS = ["model", "harness", "harness_version"];
const RUN_KEYS = [
  "run_id",
  "final_day",
  "termination_reason",
  "bankrupt",
  "final_assets_cny",
  "tool_calls",
  "turns",
  "evidence_sha256",
];

class PackError extends Error {
  name = "PackError";
}

function fail(message) {
  throw new PackError(message);
}

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} 必须是 JSON 对象`);
  }
  return value;
}

function knownKeys(value, keys, label) {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) fail(`${label} 含未知字段 ${JSON.stringify(key)}`);
  }
}

function text(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${label} 缺失或格式不合法`);
  }
  return value;
}

function visible(value, max, label) {
  if (typeof value !== "string" || value.length < 1 || value.length > max) {
    fail(`${label} 必须是 1 到 ${max} 个字符`);
  }
  for (const char of value) {
    const point = char.codePointAt(0);
    if (point < 0x20 || (point >= 0x7f && point <= 0x9f)) {
      fail(`${label} 不能包含控制字符`);
    }
  }
  return value;
}

function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${label} 必须是 ${min} 到 ${max} 的整数`);
  }
  return value;
}

function finite(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(`${label} 必须是 ${min} 到 ${max} 的有限数值`);
  }
  return value;
}

function boolean(value, label) {
  if (typeof value !== "boolean") fail(`${label} 必须是布尔值`);
  return value;
}

function calendarDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseArgs(argv) {
  let input = null;
  let output = null;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out") {
      if (output !== null) fail("--out 只能出现一次");
      index += 1;
      if (index >= argv.length) fail("--out 缺少取值");
      output = argv[index];
    } else if (token.startsWith("--")) {
      fail(`未知参数 ${JSON.stringify(token)}`);
    } else if (input === null) {
      input = token;
    } else {
      fail("只接受一个输入清单路径");
    }
  }
  if (input === null) fail("缺少输入清单路径");
  if (output === null || !output.endsWith(".json")) fail("--out 必须提供 .json 输出路径");
  return { input, output };
}

function loadManifest(inputPath) {
  const stat = statSync(inputPath, { throwIfNoEntry: false });
  if (stat === undefined || !stat.isFile()) fail(`输入清单不存在或不是普通文件：${inputPath}`);
  if (stat.size > MAX_MANIFEST_BYTES) fail(`输入清单超过 ${MAX_MANIFEST_BYTES} 字节`);
  const raw = readFileSync(inputPath, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (error) {
    fail(`输入清单不是合法 JSON：${error.message}`);
  }
  return {
    manifest: object(manifest, "清单根"),
    sha256: createHash("sha256").update(raw, "utf8").digest("hex"),
  };
}

function validateParticipant(participant) {
  object(participant, "participant");
  knownKeys(participant, PARTICIPANT_KEYS, "participant");
  text(participant.model, MODEL_PATTERN, "participant.model");
  const hasHarness = participant.harness !== undefined;
  const hasVersion = participant.harness_version !== undefined;
  if (hasHarness !== hasVersion) fail("participant.harness 与 harness_version 必须同时提供或省略");
  if (hasHarness) {
    visible(participant.harness, 120, "participant.harness");
    visible(participant.harness_version, 120, "participant.harness_version");
  }
  return participant;
}

function validateRun(run, index, seen) {
  const label = `runs[${index}]`;
  object(run, label);
  knownKeys(run, RUN_KEYS, label);
  const runId = text(run.run_id, ID_PATTERN, `${label}.run_id`);
  if (seen.has(runId)) fail(`${label}.run_id 与其他运行重复`);
  seen.add(runId);
  const finalDay = integer(run.final_day, 1, SIM_DAYS, `${label}.final_day`);
  if (!["env_completed", "env_terminated"].includes(run.termination_reason)) {
    fail(`${label}.termination_reason 必须是 env_completed 或 env_terminated`);
  }
  const bankrupt = boolean(run.bankrupt, `${label}.bankrupt`);
  const finalAssets = finite(run.final_assets_cny, -MAX_ABS_ASSETS_CNY, MAX_ABS_ASSETS_CNY, `${label}.final_assets_cny`);
  const toolCalls = integer(run.tool_calls, 0, MAX_COUNT, `${label}.tool_calls`);
  const turns = integer(run.turns, 0, MAX_COUNT, `${label}.turns`);
  text(run.evidence_sha256, SHA256_PATTERN, `${label}.evidence_sha256`);
  if (run.termination_reason === "env_completed" && (finalDay !== SIM_DAYS || bankrupt)) {
    fail(`${label}: env_completed 必须在第 365 天结束且不能标记破产`);
  }
  if (run.termination_reason === "env_terminated" && finalDay >= SIM_DAYS) {
    fail(`${label}: env_terminated 必须在第 365 天前结束`);
  }
  if (bankrupt && run.termination_reason !== "env_terminated") {
    fail(`${label}: 破产运行必须是 env_terminated`);
  }
  return { runId, finalDay, finalAssets, toolCalls, turns, bankrupt, termination: run.termination_reason, evidence: run.evidence_sha256 };
}

function validateManifest(manifest) {
  knownKeys(manifest, ROOT_KEYS, "清单根");
  if (manifest.manifest_version !== 1) fail("manifest_version 必须是 1");
  if (manifest.eval_id !== EVAL_ID) fail(`eval_id 必须是 ${EVAL_ID}`);
  if (manifest.protocol_revision !== PROTOCOL_REVISION) fail(`protocol_revision 必须是 ${PROTOCOL_REVISION}`);
  if (manifest.upstream_commit !== UPSTREAM_COMMIT) fail(`upstream_commit 必须是 ${UPSTREAM_COMMIT}`);
  object(manifest.simulation, "simulation");
  knownKeys(manifest.simulation, SIM_KEYS, "simulation");
  if (manifest.simulation.days !== SIM_DAYS) fail("simulation.days 必须是 365");
  if (manifest.simulation.initial_balance_cny !== INITIAL_BALANCE_CNY) fail("simulation.initial_balance_cny 必须是 100000");
  if (manifest.simulation.max_stores !== 4) fail("simulation.max_stores 必须是 4");
  const participant = validateParticipant(manifest.participant);
  if (!calendarDate(manifest.run_date)) fail("run_date 必须是真实的 YYYY-MM-DD 日期");
  if (!Array.isArray(manifest.runs) || manifest.runs.length !== REQUIRED_RUNS) {
    fail(`runs 必须恰好包含 ${REQUIRED_RUNS} 次运行`);
  }
  const seen = new Set();
  return { participant, runDate: manifest.run_date, runs: manifest.runs.map((run, index) => validateRun(run, index, seen)) };
}

function round(value, digits = 8) {
  return Number(value.toFixed(digits));
}

function formatCny(value) {
  const negative = value < 0;
  const [whole, fraction] = Math.abs(value).toFixed(2).split(".");
  return `${negative ? "-" : ""}¥${whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ",")}.${fraction}`;
}

function buildResult(validated, manifestSha256) {
  const meanAssets = validated.runs.reduce((sum, run) => sum + run.finalAssets, 0) / REQUIRED_RUNS;
  const score = round(meanAssets / INITIAL_BALANCE_CNY);
  const participant = { model: validated.participant.model };
  if (validated.participant.harness !== undefined) {
    participant.harness = validated.participant.harness;
    participant.harness_version = validated.participant.harness_version;
  }
  return {
    eval_id: EVAL_ID,
    submission: { kind: "run", runner_version: RUNNER_VERSION, run_date: validated.runDate },
    results: [{
      participant,
      score,
      raw_metric: { label: "五次运行平均结束总资产", value: formatCny(meanAssets) },
      detail: `五次 episode 的平均结束总资产为 ${formatCny(meanAssets)}，资产倍数 ${score}×；破产 ${validated.runs.filter((run) => run.bankrupt).length}/5。清单 sha256=${manifestSha256}。`,
      task_results: validated.runs.map((run) => ({
        task_id: TASK_ID,
        score: round(run.finalAssets / INITIAL_BALANCE_CNY),
        raw: `${run.runId}：第 ${run.finalDay} 天结束，${run.termination}${run.bankrupt ? "（破产）" : ""}，总资产 ${formatCny(run.finalAssets)}，工具调用 ${run.toolCalls} 次，Agent turn ${run.turns}；证据包 sha256=${run.evidence}。`,
      })),
      supplementary_views: [{
        type: "metric_table",
        id: "five-episode-outcomes",
        label: "五次运行",
        title: "五个独立 episode 的结束状态",
        columns: ["运行", "结束日", "终止状态", "是否破产", "结束总资产（CNY）", "资产倍数", "工具调用", "Turns"],
        rows: validated.runs.map((run) => ({ cells: [run.runId, run.finalDay, run.termination, run.bankrupt ? "是" : "否", run.finalAssets, round(run.finalAssets / INITIAL_BALANCE_CNY), run.toolCalls, run.turns] })),
        note: "五次运行均使用 365 天、10 万元初始余额、最多四家店和固定上游 commit；所有 episode 都进入算术平均。辅助展示，不构成独立排名。",
      }],
    }],
  };
}

function validateAgainstEval(result) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const evalDefinition = EvalDefSchema.parse(parseYaml(readFileSync(resolve(scriptDir, "eval.yaml"), "utf8")));
  const parsedResult = ResultFileSchema.parse(result);
  const contextual = validateResultForEval(evalDefinition, parsedResult);
  if (!contextual.success) {
    fail(`结果不符合评测定义：${JSON.stringify(contextual.error.issues)}`);
  }
  return parsedResult;
}

function writeResult(outputPath, result) {
  const absolute = resolve(outputPath);
  const temporary = `${absolute}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  renameSync(temporary, absolute);
}

try {
  const { input, output } = parseArgs(process.argv.slice(2));
  const { manifest, sha256 } = loadManifest(input);
  const validated = validateManifest(manifest);
  const result = validateAgainstEval(buildResult(validated, sha256));
  writeResult(output, result);
  console.log(`wrote ${output}`);
} catch (error) {
  console.error(`${error.name ?? "Error"}: ${error.message}`);
  process.exitCode = 1;
}
