import { createHash } from "node:crypto";
import { readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const EVAL_ID = "ceo-bench";
const TASK_ID = "novamind-500-day-run";
const RUNNER_VERSION = "ceo-bench/pack-to-result@1.0.0";
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "d2b7b32e5301a571b77f5f68bd1032adbcd5b464";
const REQUIRED_RUNS = 3;
const SIM_DAYS = 500;
const SIM_INITIAL_CASH_USD = 1_000_000;
const SIM_SEED = 42;
const SIM_SCENARIO = "default";
const CASH_ABS_LIMIT = 1e12;
const MAX_AGENT_TURNS = 1_000_000;
const MANIFEST_MAX_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]{3,128}$/u;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._/:+-]{2,255}$/u;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const MIN_VISIBLE_CODEPOINT = 0x20;
const DEL_CODEPOINT = 0x7f;
const C1_END_CODEPOINT = 0x9f;

const MANIFEST_KEYS = Object.freeze([
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "upstream_commit",
  "simulation",
  "participant",
  "run_date",
  "runs",
]);
const SIMULATION_KEYS = Object.freeze([
  "days",
  "initial_cash_usd",
  "seed",
  "scenario",
]);
const PARTICIPANT_KEYS = Object.freeze(["model", "harness", "harness_version"]);
const RUN_KEYS = Object.freeze([
  "run_id",
  "days_survived",
  "bankrupt",
  "ending_cash_usd",
  "agent_turns",
  "evidence_sha256",
]);

class PackError extends Error {
  name = "PackError";
}

function fail(message) {
  throw new PackError(message);
}

// 逐码点判断而不用字符类：源码里不出现任何控制字符字面量，
// 同时挡住把控制字符或 C1 区间带进结果文件的清单。
function isVisibleText(value, maxLength) {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > maxLength) return false;
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint < MIN_VISIBLE_CODEPOINT) return false;
    if (codePoint >= DEL_CODEPOINT && codePoint <= C1_END_CODEPOINT) {
      return false;
    }
  }
  return true;
}

function requireVisibleText(value, maxLength, label) {
  if (!isVisibleText(value, maxLength)) {
    fail(`${label} 必须是 1 到 ${maxLength} 个可见字符`);
  }
  return value;
}

function plainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} 必须是 JSON 对象`);
  }
  return value;
}

function onlyKnownKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      fail(`${label} 含未知字段 ${JSON.stringify(key)}`);
    }
  }
}

function requireString(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${label} 缺失或格式不合法`);
  }
  return value;
}

function requireInteger(value, min, max, label) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    fail(`${label} 必须是 ${min} 到 ${max} 之间的整数`);
  }
  return value;
}

function requireFinite(value, min, max, label) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    fail(`${label} 必须是 ${min} 到 ${max} 之间的有限数值`);
  }
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") {
    fail(`${label} 必须是布尔值`);
  }
  return value;
}

function isRealCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= lengths[month - 1];
}

function roundCents(value) {
  return Number((Math.round(value * 100) / 100).toFixed(2));
}

function roundTwo(value) {
  return Number(value.toFixed(2));
}

// 手写千分位而不用 Intl：转换器要在锁定的容器镜像里给出逐字节相同的结果，
// 不依赖运行环境的 ICU 数据。
function formatUsd(value) {
  const negative = value < 0;
  const [integerPart, fractionPart] = Math.abs(roundCents(value))
    .toFixed(2)
    .split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${negative ? "-" : ""}$${grouped}.${fractionPart}`;
}
function parseArgv(argv) {
  let inputPath = null;
  let outputPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out") {
      if (outputPath !== null) fail("--out 只能出现一次");
      index += 1;
      if (index >= argv.length) fail("--out 缺少取值");
      outputPath = argv[index];
      continue;
    }
    if (token.startsWith("--")) {
      fail(`未知参数 ${JSON.stringify(token)}`);
    }
    if (inputPath !== null) fail("只接受一个输入清单路径");
    inputPath = token;
  }
  if (inputPath === null) fail("缺少输入清单路径");
  if (outputPath === null) fail("缺少 --out 输出路径");
  if (!outputPath.endsWith(".json")) fail("--out 必须以 .json 结尾");
  return { inputPath, outputPath };
}

function readManifest(inputPath) {
  const stat = statSync(inputPath, { throwIfNoEntry: false });
  if (stat === undefined || !stat.isFile()) {
    fail(`输入清单不存在或不是普通文件：${inputPath}`);
  }
  if (stat.size > MANIFEST_MAX_BYTES) {
    fail(`输入清单超过 ${MANIFEST_MAX_BYTES} 字节上限`);
  }
  const raw = readFileSync(inputPath, "utf8");
  const sha256 = createHash("sha256").update(raw, "utf8").digest("hex");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`输入清单不是合法 JSON：${error.message}`);
  }
  return { manifest: plainObject(parsed, "清单根"), sha256 };
}

function validateSimulation(simulation) {
  plainObject(simulation, "simulation");
  onlyKnownKeys(simulation, SIMULATION_KEYS, "simulation");
  if (simulation.days !== SIM_DAYS) {
    fail(`simulation.days 必须是 ${SIM_DAYS}`);
  }
  if (simulation.initial_cash_usd !== SIM_INITIAL_CASH_USD) {
    fail(`simulation.initial_cash_usd 必须是 ${SIM_INITIAL_CASH_USD}`);
  }
  if (simulation.seed !== SIM_SEED) {
    fail(`simulation.seed 必须是 ${SIM_SEED}`);
  }
  if (simulation.scenario !== SIM_SCENARIO) {
    fail(`simulation.scenario 必须是 ${JSON.stringify(SIM_SCENARIO)}`);
  }
}

function validateParticipant(participant) {
  plainObject(participant, "participant");
  onlyKnownKeys(participant, PARTICIPANT_KEYS, "participant");
  requireString(participant.model, MODEL_ID_PATTERN, "participant.model");
  const hasHarness = participant.harness !== undefined;
  const hasVersion = participant.harness_version !== undefined;
  if (hasHarness !== hasVersion) {
    fail("participant.harness 与 participant.harness_version 必须同时提供或同时省略");
  }
  if (hasHarness) {
    requireVisibleText(participant.harness, 120, "participant.harness");
    requireVisibleText(
      participant.harness_version,
      120,
      "participant.harness_version",
    );
  }
  return {
    model: participant.model,
    hasHarness,
    harness: participant.harness,
    harnessVersion: participant.harness_version,
  };
}
// 上游模拟器只有「现金为负」一个破产触发条件，且跑满 500 天才算完成。
// 清单里的终止语义必须和它一致，否则拒绝出分。
function validateRun(run, index, seenRunIds) {
  const label = `runs[${index}]`;
  plainObject(run, label);
  onlyKnownKeys(run, RUN_KEYS, label);
  const runId = requireString(run.run_id, RUN_ID_PATTERN, `${label}.run_id`);
  if (seenRunIds.has(runId)) {
    fail(`${label}.run_id 与前面的运行重复：${runId}`);
  }
  seenRunIds.add(runId);
  const daysSurvived = requireInteger(
    run.days_survived,
    1,
    SIM_DAYS,
    `${label}.days_survived`,
  );
  const bankrupt = requireBoolean(run.bankrupt, `${label}.bankrupt`);
  const endingCash = requireFinite(
    run.ending_cash_usd,
    -CASH_ABS_LIMIT,
    CASH_ABS_LIMIT,
    `${label}.ending_cash_usd`,
  );
  const agentTurns = requireInteger(
    run.agent_turns,
    1,
    MAX_AGENT_TURNS,
    `${label}.agent_turns`,
  );
  requireString(
    run.evidence_sha256,
    SHA256_PATTERN,
    `${label}.evidence_sha256`,
  );
  if (bankrupt) {
    if (daysSurvived >= SIM_DAYS) {
      fail(`${label}：破产运行的 days_survived 必须小于 ${SIM_DAYS}`);
    }
    if (endingCash >= 0) {
      fail(`${label}：破产运行的 ending_cash_usd 必须为负`);
    }
  } else {
    if (daysSurvived !== SIM_DAYS) {
      fail(`${label}：完成运行的 days_survived 必须等于 ${SIM_DAYS}`);
    }
    if (endingCash < 0) {
      fail(`${label}：完成运行的 ending_cash_usd 不得为负`);
    }
  }
  return {
    runId,
    daysSurvived,
    bankrupt,
    endingCash: roundCents(endingCash),
    agentTurns,
    evidenceSha256: run.evidence_sha256,
  };
}

function validateManifest(manifest) {
  onlyKnownKeys(manifest, MANIFEST_KEYS, "清单根");
  if (manifest.manifest_version !== 1) {
    fail("manifest_version 必须是 1");
  }
  if (manifest.eval_id !== EVAL_ID) {
    fail(`eval_id 必须是 ${JSON.stringify(EVAL_ID)}`);
  }
  if (manifest.protocol_revision !== PROTOCOL_REVISION) {
    fail(`protocol_revision 必须是 ${PROTOCOL_REVISION}`);
  }
  if (manifest.upstream_commit !== UPSTREAM_COMMIT) {
    fail(`upstream_commit 必须是本评测钉死的 ${UPSTREAM_COMMIT}`);
  }
  validateSimulation(manifest.simulation);
  const participant = validateParticipant(manifest.participant);
  const runDate = requireString(
    manifest.run_date,
    CALENDAR_DATE_PATTERN,
    "run_date",
  );
  if (!isRealCalendarDate(runDate)) {
    fail(`run_date 不是真实存在的日期：${runDate}`);
  }
  if (!Array.isArray(manifest.runs) || manifest.runs.length !== REQUIRED_RUNS) {
    fail(`runs 必须是恰好 ${REQUIRED_RUNS} 次独立运行`);
  }
  const seenRunIds = new Set();
  const runs = manifest.runs.map((run, index) =>
    validateRun(run, index, seenRunIds),
  );
  return { participant, runDate, runs };
}
// 上游「最佳运行」口径：先比存活天数，再比结束现金。
function pickBestRun(runs) {
  return runs.reduce((best, candidate) => {
    if (candidate.daysSurvived !== best.daysSurvived) {
      return candidate.daysSurvived > best.daysSurvived ? candidate : best;
    }
    return candidate.endingCash > best.endingCash ? candidate : best;
  });
}

function buildRunsView(runs) {
  return {
    type: "metric_table",
    id: "per-run-outcomes",
    label: "三次运行",
    title: "三次独立运行的结束状态",
    columns: [
      "运行",
      "存活天数",
      "是否破产",
      "结束现金（USD）",
      "Agent 操作轮数",
    ],
    rows: runs.map((run) => ({
      cells: [
        run.runId,
        run.daysSurvived,
        run.bankrupt ? "是" : "否",
        run.endingCash,
        run.agentTurns,
      ],
    })),
    note:
      `三次运行均为 ${SIM_DAYS} 天、初始现金 ${formatUsd(SIM_INITIAL_CASH_USD)}、` +
      `seed=${SIM_SEED}、scenario=${SIM_SCENARIO} 的同一配置。` +
      "破产触发条件只有现金为负一条；表中数值来自提交清单，仅作解释用途，不参与排名。",
  };
}

function buildResultEntry({ participant, runs, bestRun, manifestSha256 }) {
  const survived = runs.filter((run) => !run.bankrupt).length;
  const meanDays = roundTwo(
    runs.reduce((sum, run) => sum + run.daysSurvived, 0) / runs.length,
  );
  const entry = {
    participant: { model: participant.model },
    // 与上游榜单一致：三次运行全部破产时主成绩记 0，不用负数现金参与排名。
    score: Math.max(0, bestRun.endingCash),
    raw_metric: {
      label: "最佳运行结束现金",
      value: formatUsd(bestRun.endingCash),
      tiebreak_value: bestRun.daysSurvived,
    },
    detail:
      `最佳运行 ${bestRun.runId}：存活 ${bestRun.daysSurvived} 天，` +
      `结束现金 ${formatUsd(bestRun.endingCash)}。` +
      `三次运行完成 ${survived}/${runs.length}，平均存活 ${meanDays} 天。` +
      `清单 sha256=${manifestSha256}。`,
    task_results: runs.map((run) => ({
      task_id: TASK_ID,
      score: Math.max(0, run.endingCash),
      raw:
        `${run.runId}：存活 ${run.daysSurvived} 天，` +
        `${run.bankrupt ? "破产结束" : "跑满全程"}，` +
        `结束现金 ${formatUsd(run.endingCash)}，` +
        `Agent 操作 ${run.agentTurns} 轮，` +
        `证据包 sha256=${run.evidenceSha256}。`,
    })),
    supplementary_views: [buildRunsView(runs)],
  };
  if (participant.hasHarness) {
    entry.participant.harness = participant.harness;
    entry.participant.harness_version = participant.harnessVersion;
  }
  return entry;
}
function loadEvalContext() {
  const evalYamlPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "eval.yaml",
  );
  const parsed = EvalDefSchema.safeParse(
    parseYaml(readFileSync(evalYamlPath, "utf8")),
  );
  if (!parsed.success) {
    fail(
      `本评测的 eval.yaml 自身不合法：${JSON.stringify(parsed.error.issues)}`,
    );
  }
  if (parsed.data.protocol_revision !== PROTOCOL_REVISION) {
    fail("eval.yaml 的 protocol_revision 与转换器钉死的版本不一致");
  }
  return parsed.data;
}

function writeAtomic(outputPath, text) {
  const target = resolve(outputPath);
  if (basename(target) !== basename(outputPath)) {
    fail("--out 必须是文件名，不接受目录形式");
  }
  const partial = `${target}.partial`;
  writeFileSync(partial, text, { encoding: "utf8", mode: 0o600 });
  renameSync(partial, target);
}

function main(argv) {
  const { inputPath, outputPath } = parseArgv(argv);
  const { manifest, sha256 } = readManifest(inputPath);
  const { participant, runDate, runs } = validateManifest(manifest);
  const bestRun = pickBestRun(runs);
  const resultFile = {
    eval_id: EVAL_ID,
    submission: {
      kind: "run",
      runner_version: RUNNER_VERSION,
      run_date: runDate,
    },
    results: [
      buildResultEntry({
        participant,
        runs,
        bestRun,
        manifestSha256: sha256,
      }),
    ],
  };

  const structural = ResultFileSchema.safeParse(resultFile);
  if (!structural.success) {
    fail(
      `生成的结果文件不符合结果结构：${JSON.stringify(structural.error.issues)}`,
    );
  }
  const evalContext = loadEvalContext();
  const evalAware = validateResultForEval(evalContext, structural.data);
  if (!evalAware.success) {
    fail(
      `生成的结果文件不满足本评测的约束：${JSON.stringify(
        evalAware.error.issues,
      )}`,
    );
  }

  writeAtomic(outputPath, `${JSON.stringify(structural.data, null, 2)}\n`);
  process.stdout.write(
    `已写出 ${outputPath}：最佳运行 ${bestRun.runId}，` +
      `存活 ${bestRun.daysSurvived} 天，` +
      `主成绩 ${formatUsd(Math.max(0, bestRun.endingCash))}\n`,
  );
}

try {
  main(process.argv.slice(2));
} catch (error) {
  if (error instanceof PackError) {
    process.stderr.write(`转换失败：${error.message}\n`);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
