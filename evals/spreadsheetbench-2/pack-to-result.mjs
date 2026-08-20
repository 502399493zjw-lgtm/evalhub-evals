#!/usr/bin/env node

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildModelIndex,
  loadModelRegistry,
  resolveModel,
} from "../../scripts/model-contract.mjs";

const EVAL_ID = "spreadsheetbench-2";
const PROTOCOL_REVISION = 1;
const RUNNER_VERSION = "spreadsheetbench-2/mean-rubric-pack@1.0.0";
const DATASET_REPO = "KAKA22/SpreadsheetBench-v2";
const DATASET_COMMIT = "9dea60025792fbac5928ce9f44812362dccbeecd";
const DATASET_ARCHIVE_SHA256 =
  "17147ef9578cd57ce76c9a719d19da7821f3e5cb0d8f776c820f699fdcdb761c";
const CODE_REPO = "RUCKBReasoning/SpreadsheetBench-2";
const CODE_COMMIT = "83d415ce87b1d6b8e8eafcc26957f5d13d37210f";
const SCORE_CONTRACT = "spreadsheetbench-2-live-mean-rubric-v1";
const MANIFEST_MAX_BYTES = 2 * 1024 * 1024;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const IDENTITY_PATTERN = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;
const STATUSES = new Set(["success", "failed", "timeout", "missing"]);
const CATEGORY_ORDER = Object.freeze([
  "Debugging",
  "Financial_Model",
  "Template",
  "Visualization",
]);

const taskIndex = JSON.parse(
  readFileSync(new URL("./tasks/task-index.json", import.meta.url), "utf8"),
);

const MANIFEST_KEYS = Object.freeze([
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "benchmark",
  "participant",
  "run_date",
  "synthetic",
  "artifact_sha256",
  "task_results",
]);
const BENCHMARK_KEYS = Object.freeze([
  "dataset_repo",
  "dataset_commit",
  "dataset_archive_sha256",
  "code_repo",
  "code_commit",
  "score_contract",
]);
const PARTICIPANT_KEYS = Object.freeze([
  "model",
  "harness",
  "harness_version",
]);
const TASK_RESULT_KEYS = Object.freeze([
  "task_id",
  "category",
  "status",
  "score",
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

function requireExact(value, expected, label) {
  if (value !== expected) {
    fail(`${label} 必须是本协议固定值 ${expected}`);
  }
}

function isRealCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= lengths[month - 1];
}

function roundSix(value) {
  return Number(value.toFixed(6));
}

function parseArgv(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") {
    fail(
      "用法：node evals/spreadsheetbench-2/pack-to-result.mjs <submission.json> --out <result.json>",
    );
  }
  if (!argv[0] || !argv[2]?.endsWith(".json")) {
    fail("输入路径不能为空，输出路径必须以 .json 结尾");
  }
  return { input: resolve(argv[0]), output: resolve(argv[2]) };
}

function readManifest(inputPath) {
  let stats;
  try {
    stats = statSync(inputPath);
  } catch (error) {
    fail(`无法读取提交清单：${error.message}`);
  }
  if (!stats.isFile()) fail("提交清单必须是普通文件");
  if (stats.size > MANIFEST_MAX_BYTES) {
    fail(`提交清单超过 ${MANIFEST_MAX_BYTES} 字节上限`);
  }
  try {
    return JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (error) {
    fail(`提交清单不是合法 JSON：${error.message}`);
  }
}

function validateBenchmark(raw) {
  const benchmark = plainObject(raw, "benchmark");
  onlyKnownKeys(benchmark, BENCHMARK_KEYS, "benchmark");
  requireExact(benchmark.dataset_repo, DATASET_REPO, "benchmark.dataset_repo");
  requireExact(
    benchmark.dataset_commit,
    DATASET_COMMIT,
    "benchmark.dataset_commit",
  );
  requireExact(
    benchmark.dataset_archive_sha256,
    DATASET_ARCHIVE_SHA256,
    "benchmark.dataset_archive_sha256",
  );
  requireExact(benchmark.code_repo, CODE_REPO, "benchmark.code_repo");
  requireExact(benchmark.code_commit, CODE_COMMIT, "benchmark.code_commit");
  requireExact(
    benchmark.score_contract,
    SCORE_CONTRACT,
    "benchmark.score_contract",
  );
}

function validateParticipant(raw, modelIndex) {
  const participant = plainObject(raw, "participant");
  onlyKnownKeys(participant, PARTICIPANT_KEYS, "participant");
  const rawModel = requireString(
    participant.model,
    IDENTITY_PATTERN,
    "participant.model",
  );
  const resolution = resolveModel(rawModel, modelIndex);
  if (resolution.status !== "mapped") {
    const suggestions =
      resolution.suggestions.length > 0
        ? `；建议：${resolution.suggestions.join(" / ")}`
        : "";
    fail(`participant.model 无法无歧义映射到 EvalHub registry${suggestions}`);
  }
  return {
    model: resolution.canonicalModelId,
    harness: requireString(
      participant.harness,
      IDENTITY_PATTERN,
      "participant.harness",
    ),
    harness_version: requireString(
      participant.harness_version,
      IDENTITY_PATTERN,
      "participant.harness_version",
    ),
  };
}

function validateTaskResult(raw, index) {
  const label = `task_results[${index}]`;
  const result = plainObject(raw, label);
  onlyKnownKeys(result, TASK_RESULT_KEYS, label);
  const expected = taskIndex[index];
  requireExact(result.task_id, expected.task_id, `${label}.task_id`);
  requireExact(result.category, expected.category, `${label}.category`);
  if (!STATUSES.has(result.status)) {
    fail(`${label}.status 必须是 success、failed、timeout 或 missing`);
  }
  const score = requireFinite(result.score, 0, 1, `${label}.score`);
  if (result.status !== "success" && score !== 0) {
    fail(`${label} 在非 success 状态下 score 必须是 0`);
  }
  if (
    result.category !== "Visualization" &&
    result.status === "success" &&
    score !== 0 &&
    score !== 1
  ) {
    fail(`${label} 非可视化任务的 success score 只能是 0 或 1`);
  }
  return {
    taskId: result.task_id,
    category: result.category,
    status: result.status,
    score,
  };
}

function validateManifest(raw, modelIndex) {
  const manifest = plainObject(raw, "提交清单");
  onlyKnownKeys(manifest, MANIFEST_KEYS, "提交清单");
  if (manifest.manifest_version !== 1) fail("manifest_version 目前只支持 1");
  requireExact(manifest.eval_id, EVAL_ID, "eval_id");
  requireExact(
    manifest.protocol_revision,
    PROTOCOL_REVISION,
    "protocol_revision",
  );
  validateBenchmark(manifest.benchmark);
  const participant = validateParticipant(manifest.participant, modelIndex);
  const runDate = requireString(
    manifest.run_date,
    CALENDAR_DATE_PATTERN,
    "run_date",
  );
  if (!isRealCalendarDate(runDate)) fail("run_date 必须是真实存在的日期");
  if (typeof manifest.synthetic !== "boolean") {
    fail("synthetic 必须是布尔值；生产提交应为 false");
  }
  const artifactSha256 = requireString(
    manifest.artifact_sha256,
    SHA256_PATTERN,
    "artifact_sha256",
  );
  if (
    !Array.isArray(manifest.task_results) ||
    manifest.task_results.length !== taskIndex.length
  ) {
    fail(`task_results 必须按固定顺序完整包含 ${taskIndex.length} 条`);
  }
  const taskResults = manifest.task_results.map(validateTaskResult);
  return {
    participant,
    runDate,
    synthetic: manifest.synthetic,
    artifactSha256,
    taskResults,
  };
}

function buildComponentRows(taskResults) {
  return CATEGORY_ORDER.map((category) => {
    const rows = taskResults.filter((row) => row.category === category);
    const successes = rows.filter((row) => row.status === "success").length;
    const percent = roundSix(
      (rows.reduce((sum, row) => sum + row.score, 0) / rows.length) * 100,
    );
    return {
      category,
      count: rows.length,
      successes,
      percent,
    };
  });
}

function buildResult(validated) {
  const score = roundSix(
    (validated.taskResults.reduce((sum, row) => sum + row.score, 0) /
      validated.taskResults.length) *
      100,
  );
  const componentRows = buildComponentRows(validated.taskResults);
  const fixtureLabel = validated.synthetic
    ? "结构性合成 fixture"
    : "外部工作流清单";
  return {
    eval_id: EVAL_ID,
    submission: {
      kind: "run",
      runner_version: RUNNER_VERSION,
      run_date: validated.runDate,
    },
    results: [
      {
        participant: validated.participant,
        score,
        raw_metric: {
          label: "321 题等权平均",
          value: `${score} 分`,
          tiebreak_value: score,
        },
        detail:
          `${fixtureLabel}；固定数据 commit ${DATASET_COMMIT}，代码 commit ${CODE_COMMIT}。` +
          "297 个非可视化任务按 exact task accuracy 计 0/1；24 个 Visualization 任务按 mean rubric pass rate 计 0–1；" +
          `321 题等权平均后乘 100。artifact_sha256=${validated.artifactSha256}。` +
          "打包器只复核清单结构、模型身份与算术，不代表 EvalHub 运行或验证外部证据。",
        task_results: validated.taskResults.map((row) => ({
          task_id: row.taskId,
          score: roundSix(row.score * 100),
          raw: `${row.category} · ${row.status} · raw score=${row.score}`,
        })),
        supplementary_views: [
          {
            type: "metric_table",
            id: "run-category-breakdown",
            label: "本次四分项",
            title: "SpreadsheetBench 2 本次运行四类任务分数",
            columns: ["分项", "任务数", "success 状态数", "分项分数"],
            rows: componentRows.map((row) => ({
              cells: [
                row.category === "Financial_Model"
                  ? "Financial Modeling"
                  : row.category,
                row.count,
                row.successes,
                row.percent,
              ],
            })),
            note:
              "分项分数由固定清单逐题确定性聚合；总分是四类按 100/100/97/24 个任务加权后的 321 题等权平均。Visualization 使用 rubric pass rate，不使用 >0.7 二值 ACC。只有结果条目的 score 参与排名；本表只作解释。",
          },
        ],
      },
    ],
  };
}

async function main() {
  const paths = parseArgv(process.argv.slice(2));
  const registry = await loadModelRegistry();
  const modelIndex = buildModelIndex(registry);
  const result = buildResult(
    validateManifest(readManifest(paths.input), modelIndex),
  );
  writeFileSync(paths.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`spreadsheetbench-2 pack error: ${message}\n`);
  process.exitCode = 1;
}
