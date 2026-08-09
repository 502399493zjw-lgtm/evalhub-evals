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

const EVAL_ID = "rsibench-data";
const RUNNER_VERSION = "rsibench-data/pack-to-result@1.0.0";
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "4c807610243e7b481d382c5ed360c71c79a22f61";
const TARGET_MODEL = "Qwen/Qwen3.5-35B-A3B-Base";
const WALL_CLOCK_BUDGET_HOURS = 16;
const TINKER_COST_BUDGET_USD = 500;
const MANIFEST_MAX_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]{3,128}$/u;
const CHECKPOINT_PATTERN = /^tinker:\/\/[A-Za-z0-9._/-]{3,200}$/u;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._/:+-]{4,255}$/u;
const IDENTITY_TEXT_PATTERN = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

// 六个 profile 的分母、评测 agent 与权重全部来自钉死的上游来源：任务数与解码次数
// 转录自 commit 4c807610 的 benchmarks/<key>/spec.json，权重转录自 Evolvent AI
// 官方榜单页。转换器不接受提交方自带的分母或权重，避免用改分母的方式抬分。
const PROFILES = Object.freeze([
  Object.freeze({
    taskId: "swe-bench-verified",
    name: "SWE-bench Verified",
    agent: "mini-swe-agent",
    nTasks: 100,
    nAttempts: 1,
    weight: 0.2,
  }),
  Object.freeze({
    taskId: "swe-bench-multilingual",
    name: "SWE-bench Multilingual",
    agent: "mini-swe-agent",
    nTasks: 100,
    nAttempts: 1,
    weight: 0.2,
  }),
  Object.freeze({
    taskId: "swe-bench-pro",
    name: "SWE-bench Pro",
    agent: "mini-swe-agent",
    nTasks: 100,
    nAttempts: 1,
    weight: 0.2,
  }),
  Object.freeze({
    taskId: "terminal-bench-2",
    name: "Terminal-Bench 2.0",
    agent: "terminus-2",
    nTasks: 89,
    nAttempts: 1,
    weight: 0.2,
  }),
  Object.freeze({
    taskId: "gpqa-diamond",
    name: "GPQA Diamond",
    agent: "terminus-2",
    nTasks: 100,
    nAttempts: 1,
    weight: 0.1,
  }),
  Object.freeze({
    taskId: "aime",
    name: "AIME 2026",
    agent: "terminus-2",
    nTasks: 30,
    nAttempts: 4,
    weight: 0.1,
  }),
]);

const RUN_KEYS = Object.freeze([
  "task_id",
  "run_id",
  "checkpoint",
  "checkpoint_selected_before_official_eval",
  "data_isolation_audit",
  "official_eval",
  "budget",
  "evidence_sha256",
]);
const OFFICIAL_EVAL_KEYS = Object.freeze(["passed", "n_tasks", "n_attempts"]);
const BUDGET_KEYS = Object.freeze(["wall_clock_hours", "tinker_cost_usd"]);
const MANIFEST_KEYS = Object.freeze([
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "upstream_commit",
  "target_model",
  "participant",
  "run_date",
  "runs",
]);
const PARTICIPANT_KEYS = Object.freeze([
  "model",
  "harness",
  "harness_version",
]);

class PackError extends Error {}

function fail(message) {
  throw new PackError(message);
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

function isRealCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= lengths[month - 1];
}

function roundSix(value) {
  return Number(value.toFixed(6));
}

function parseArgv(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") {
    fail("用法：node evals/rsibench-data/pack-to-result.mjs <submission.json> --out <result.json>");
  }
  const input = argv[0];
  const output = argv[2];
  if (typeof input !== "string" || input.length === 0) {
    fail("缺少提交清单路径");
  }
  if (typeof output !== "string" || !output.endsWith(".json")) {
    fail("输出路径必须以 .json 结尾");
  }
  return { input: resolve(input), output: resolve(output) };
}

function readManifest(inputPath) {
  let stats;
  try {
    stats = statSync(inputPath);
  } catch (error) {
    fail(`无法读取提交清单：${error.message}`);
  }
  if (!stats.isFile()) {
    fail("提交清单必须是普通文件");
  }
  if (stats.size > MANIFEST_MAX_BYTES) {
    fail(`提交清单超过 ${MANIFEST_MAX_BYTES} 字节上限`);
  }
  let source;
  try {
    source = readFileSync(inputPath, "utf8");
  } catch (error) {
    fail(`无法读取提交清单：${error.message}`);
  }
  try {
    return { manifest: JSON.parse(source), digest: createHash("sha256").update(source).digest("hex") };
  } catch (error) {
    fail(`提交清单不是合法 JSON：${error.message}`);
  }
}

function validateParticipant(raw) {
  const participant = plainObject(raw, "participant");
  onlyKnownKeys(participant, PARTICIPANT_KEYS, "participant");
  const model = requireString(participant.model, MODEL_ID_PATTERN, "participant.model");
  const harness = requireString(participant.harness, IDENTITY_TEXT_PATTERN, "participant.harness");
  const harnessVersion = requireString(
    participant.harness_version,
    IDENTITY_TEXT_PATTERN,
    "participant.harness_version",
  );
  if (model === TARGET_MODEL) {
    fail("participant.model 必须是研究者 Agent 的编排模型，不能填目标模型");
  }
  return { model, harness, harness_version: harnessVersion };
}

function validateRun(raw, profile) {
  const run = plainObject(raw, `runs[${profile.taskId}]`);
  onlyKnownKeys(run, RUN_KEYS, `runs[${profile.taskId}]`);
  requireString(run.run_id, RUN_ID_PATTERN, `runs[${profile.taskId}].run_id`);
  requireString(run.checkpoint, CHECKPOINT_PATTERN, `runs[${profile.taskId}].checkpoint`);
  requireString(
    run.evidence_sha256,
    SHA256_PATTERN,
    `runs[${profile.taskId}].evidence_sha256`,
  );
  if (run.checkpoint_selected_before_official_eval !== true) {
    fail(
      `runs[${profile.taskId}]：检查点必须在官方复评之前选定，checkpoint_selected_before_official_eval 只接受 true`,
    );
  }
  if (run.data_isolation_audit !== "passed") {
    fail(
      `runs[${profile.taskId}]：数据隔离审计必须为 passed，否则该运行不符合评测数据边界`,
    );
  }
  const officialEval = plainObject(run.official_eval, `runs[${profile.taskId}].official_eval`);
  onlyKnownKeys(officialEval, OFFICIAL_EVAL_KEYS, `runs[${profile.taskId}].official_eval`);
  if (officialEval.n_tasks !== profile.nTasks || officialEval.n_attempts !== profile.nAttempts) {
    fail(
      `runs[${profile.taskId}]：官方复评规模被锁定为 ${profile.nTasks} 题 × ${profile.nAttempts} 次解码，提交声明的分母不一致`,
    );
  }
  const denominator = profile.nTasks * profile.nAttempts;
  const passed = requireInteger(
    officialEval.passed,
    0,
    denominator,
    `runs[${profile.taskId}].official_eval.passed`,
  );
  const budget = plainObject(run.budget, `runs[${profile.taskId}].budget`);
  onlyKnownKeys(budget, BUDGET_KEYS, `runs[${profile.taskId}].budget`);
  requireFinite(
    budget.wall_clock_hours,
    0,
    WALL_CLOCK_BUDGET_HOURS,
    `runs[${profile.taskId}].budget.wall_clock_hours`,
  );
  requireFinite(
    budget.tinker_cost_usd,
    0,
    TINKER_COST_BUDGET_USD,
    `runs[${profile.taskId}].budget.tinker_cost_usd`,
  );
  return { profile, passed, denominator, budget, checkpoint: run.checkpoint, runId: run.run_id };
}

function validateManifest(raw) {
  const manifest = plainObject(raw, "提交清单");
  onlyKnownKeys(manifest, MANIFEST_KEYS, "提交清单");
  if (manifest.manifest_version !== 1) {
    fail("manifest_version 目前只支持 1");
  }
  if (manifest.eval_id !== EVAL_ID) {
    fail(`eval_id 必须是 ${EVAL_ID}`);
  }
  if (manifest.protocol_revision !== PROTOCOL_REVISION) {
    fail(`protocol_revision 必须是 ${PROTOCOL_REVISION}`);
  }
  if (manifest.upstream_commit !== UPSTREAM_COMMIT) {
    fail("upstream_commit 必须是本评测钉死的来源 commit");
  }
  if (manifest.target_model !== TARGET_MODEL) {
    fail(`target_model 必须是 ${TARGET_MODEL}`);
  }
  const runDate = requireString(manifest.run_date, CALENDAR_DATE_PATTERN, "run_date");
  if (!isRealCalendarDate(runDate)) {
    fail("run_date 必须是真实存在的日期");
  }
  const participant = validateParticipant(manifest.participant);
  if (!Array.isArray(manifest.runs) || manifest.runs.length !== PROFILES.length) {
    fail(`runs 必须是长度为 ${PROFILES.length} 的数组，六个 profile 各一次独立运行`);
  }
  const byTaskId = new Map();
  for (const [index, entry] of manifest.runs.entries()) {
    const candidate = plainObject(entry, `runs[${index}]`);
    const taskId = candidate.task_id;
    const profile = PROFILES.find((item) => item.taskId === taskId);
    if (profile === undefined) {
      fail(`runs[${index}].task_id ${JSON.stringify(taskId)} 不是本评测的 profile`);
    }
    if (byTaskId.has(taskId)) {
      fail(`runs：profile ${taskId} 重复提交`);
    }
    byTaskId.set(taskId, validateRun(candidate, profile));
  }
  return { participant, runDate, runs: PROFILES.map((profile) => byTaskId.get(profile.taskId)) };
}

function scoreRuns(runs) {
  const rows = [];
  let total = 0;
  for (const run of runs) {
    const profileScore = roundSix((run.passed / run.denominator) * 100);
    const contribution = roundSix(run.profile.weight * profileScore);
    total += run.profile.weight * profileScore;
    rows.push({ ...run, profileScore, contribution });
  }
  const weightSum = roundSix(PROFILES.reduce((sum, profile) => sum + profile.weight, 0));
  if (weightSum !== 1) {
    fail("内置权重之和必须为 1，转换器拒绝在权重不完整时给分");
  }
  const totalScore = roundSix(total);
  if (!Number.isFinite(totalScore) || totalScore < 0 || totalScore > 100) {
    fail("加权总分越界，拒绝写出结果");
  }
  return { rows, totalScore };
}

function buildEnvelope({ participant, runDate, rows, totalScore, manifestDigest }) {
  return {
    eval_id: EVAL_ID,
    submission: { kind: "run", runner_version: RUNNER_VERSION, run_date: runDate },
    results: [
      {
        participant,
        score: totalScore,
        raw_metric: {
          label: "六项加权总分",
          value: `${totalScore} 分`,
          tiebreak_value: totalScore,
        },
        detail: [
          `六个 profile 各跑一次独立预算运行，目标模型 ${TARGET_MODEL}，来源 commit ${UPSTREAM_COMMIT}。`,
          "分项分数 = 官方复评通过数 ÷ 锁定分母 × 100；总分按官方榜单权重加权（SWE 三项与 Terminal-Bench 2.0 各 0.2，GPQA Diamond 与 AIME 2026 各 0.1）。",
          `提交清单 sha256=${manifestDigest}。分母、权重与预算上限由转换器内置，不接受提交方覆盖。`,
        ].join(""),
        task_results: rows.map((row) => ({
          task_id: row.profile.taskId,
          score: row.profileScore,
          raw: `${row.passed}/${row.denominator} · ${row.profile.agent} · ${row.checkpoint}`,
        })),
        supplementary_views: [
          {
            type: "metric_table",
            id: "run-benchmark-breakdown",
            label: "本次分项",
            title: "本次运行的六项分项成绩",
            columns: ["分项", "权重", "通过/试次", "分项分数", "加权贡献"],
            rows: rows.map((row) => ({
              cells: [
                row.profile.name,
                row.profile.weight,
                `${row.passed}/${row.denominator}`,
                row.profileScore,
                row.contribution,
              ],
            })),
            note: "分项分数与加权贡献由转换器按内置分母和官方权重确定性算出，仅解释主分数，不参与排名。",
          },
          {
            type: "metric_table",
            id: "run-budget-usage",
            label: "预算用量",
            title: "各 profile 的预算用量",
            columns: ["分项", "用时（小时）", "Tinker 成本（USD）", "运行标识"],
            rows: rows.map((row) => ({
              cells: [
                row.profile.name,
                row.budget.wall_clock_hours,
                row.budget.tinker_cost_usd,
                row.runId,
              ],
            })),
            note: `名义上限为每次运行 ${WALL_CLOCK_BUDGET_HOURS} 小时墙钟与 ${TINKER_COST_BUDGET_USD} USD Tinker 额度；超出即转换失败。资源用量不进入评分。`,
          },
        ],
      },
    ],
  };
}

function loadEvalDefinition() {
  const yamlPath = resolve(dirname(fileURLToPath(import.meta.url)), "eval.yaml");
  let source;
  try {
    source = readFileSync(yamlPath, "utf8");
  } catch (error) {
    fail(`无法读取 eval.yaml：${error.message}`);
  }
  const parsed = EvalDefSchema.safeParse(parseYaml(source));
  if (!parsed.success) {
    fail(`eval.yaml 不合法：${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return parsed.data;
}

function writeAtomic(outputPath, envelope) {
  const temporaryPath = resolve(dirname(outputPath), `.${basename(outputPath)}.partial`);
  writeFileSync(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, outputPath);
}

function main(argv) {
  const { input, output } = parseArgv(argv);
  const { manifest, digest } = readManifest(input);
  const { participant, runDate, runs } = validateManifest(manifest);
  const { rows, totalScore } = scoreRuns(runs);
  const envelope = buildEnvelope({
    participant,
    runDate,
    rows,
    totalScore,
    manifestDigest: digest,
  });
  const generic = ResultFileSchema.safeParse(envelope);
  if (!generic.success) {
    fail(`生成的结果不符合结果结构：${generic.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  const contextual = validateResultForEval(loadEvalDefinition(), generic.data);
  if (!contextual.success) {
    fail(`生成的结果不符合本评测契约：${contextual.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  writeAtomic(output, generic.data);
  console.log(`${EVAL_ID}: ${participant.harness} / ${participant.model} = ${totalScore} 分`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`rsibench-data 转换失败：${error.message}`);
  process.exitCode = 1;
}
