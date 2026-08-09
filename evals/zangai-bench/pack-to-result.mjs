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

const EVAL_ID = "zangai-bench";
const RUNNER_VERSION = "zangai-bench/pack-to-result@1.0.0";
const PROTOCOL_REVISION = 1;
const TRIAL_COUNT = 10;
const MANIFEST_MAX_BYTES = 512 * 1024;
const PROMPT_SHA256 = "cd7c9074d60e342fd877f70253444dc0fe278897fc6e20715800e67a336eef9c";
const GRAPH_SHA256 = "f83313f6e50b2f1bb809c9c1fc0de2217c437e33b1fa417b571b6527b7df988e";
const SCORER_SHA256 = "6f773714090a5a1da48d15fb493f0d7dd08aa6d5a6b8944988846cee3b115828";
const OPENCODE_VERSION = "1.17.9";
const PLAYWRIGHT_VERSION = "1.61.1";
const SCORER_VERSION = "3.1";
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._/:+-]{1,255}$/u;
const IDENTITY_TEXT_PATTERN = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const STATUSES = Object.freeze(["scored", "failed", "timeout", "missing"]);
const TOP_LEVEL_KEYS = Object.freeze([
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "protocol",
  "participant",
  "run_date",
  "trials",
]);
const PROTOCOL_KEYS = Object.freeze([
  "prompt_sha256",
  "graph_sha256",
  "scorer_sha256",
  "opencode_version",
  "playwright_version",
  "scorer_version",
  "trial_count",
]);
const PARTICIPANT_KEYS = Object.freeze(["model", "harness", "harness_version"]);
const TRIAL_KEYS = Object.freeze(["round", "status", "score", "evidence_sha256"]);

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
    if (!allowed.includes(key)) fail(`${label} 含未知字段 ${JSON.stringify(key)}`);
  }
}

function requireString(value, pattern, label) {
  if (typeof value !== "string" || value !== value.trim() || !pattern.test(value)) {
    fail(`${label} 缺失或格式不合法`);
  }
  return value;
}

function requireInteger(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${label} 必须是 ${min} 到 ${max} 之间的整数`);
  }
  return value;
}

function requireFinite(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(`${label} 必须是 ${min} 到 ${max} 之间的有限数值`);
  }
  return value;
}

function isRealCalendarDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= lengths[month - 1];
}

function roundTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseArgv(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") {
    fail("用法：node evals/zangai-bench/pack-to-result.mjs <submission.json> --out <result.json>");
  }
  if (typeof argv[0] !== "string" || argv[0].length === 0) fail("缺少提交清单路径");
  if (typeof argv[2] !== "string" || !argv[2].endsWith(".json")) {
    fail("输出路径必须以 .json 结尾");
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
  if (stats.size > MANIFEST_MAX_BYTES) fail(`提交清单超过 ${MANIFEST_MAX_BYTES} 字节上限`);
  let source;
  try {
    source = readFileSync(inputPath, "utf8");
  } catch (error) {
    fail(`无法读取提交清单：${error.message}`);
  }
  try {
    return {
      manifest: JSON.parse(source),
      digest: createHash("sha256").update(source).digest("hex"),
    };
  } catch (error) {
    fail(`提交清单不是合法 JSON：${error.message}`);
  }
}

function validateProtocol(raw) {
  const protocol = plainObject(raw, "protocol");
  onlyKnownKeys(protocol, PROTOCOL_KEYS, "protocol");
  const expected = {
    prompt_sha256: PROMPT_SHA256,
    graph_sha256: GRAPH_SHA256,
    scorer_sha256: SCORER_SHA256,
    opencode_version: OPENCODE_VERSION,
    playwright_version: PLAYWRIGHT_VERSION,
    scorer_version: SCORER_VERSION,
    trial_count: TRIAL_COUNT,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (protocol[key] !== value) {
      fail(`protocol.${key} 必须是 ${JSON.stringify(value)}`);
    }
  }
  return expected;
}

function validateParticipant(raw) {
  const participant = plainObject(raw, "participant");
  onlyKnownKeys(participant, PARTICIPANT_KEYS, "participant");
  return {
    model: requireString(participant.model, MODEL_ID_PATTERN, "participant.model"),
    harness: requireString(participant.harness, IDENTITY_TEXT_PATTERN, "participant.harness"),
    harness_version: requireString(
      participant.harness_version,
      IDENTITY_TEXT_PATTERN,
      "participant.harness_version",
    ),
  };
}

function validateTrial(raw, index) {
  const trial = plainObject(raw, `trials[${index}]`);
  onlyKnownKeys(trial, TRIAL_KEYS, `trials[${index}]`);
  const round = requireInteger(trial.round, 1, TRIAL_COUNT, `trials[${index}].round`);
  if (!STATUSES.includes(trial.status)) {
    fail(`trials[${index}].status 必须是 ${STATUSES.join(" / ")}`);
  }
  const score = requireFinite(trial.score, 0, 100, `trials[${index}].score`);
  if (trial.status !== "scored" && score !== 0) {
    fail(`trials[${index}] 状态为 ${trial.status} 时 score 必须为 0`);
  }
  const evidence = requireString(
    trial.evidence_sha256,
    SHA256_PATTERN,
    `trials[${index}].evidence_sha256`,
  );
  return { round, status: trial.status, score, evidence_sha256: evidence };
}

function validateManifest(raw) {
  const manifest = plainObject(raw, "提交清单");
  onlyKnownKeys(manifest, TOP_LEVEL_KEYS, "提交清单");
  if (manifest.manifest_version !== 1) fail("manifest_version 必须是 1");
  if (manifest.eval_id !== EVAL_ID) fail(`eval_id 必须是 ${EVAL_ID}`);
  if (manifest.protocol_revision !== PROTOCOL_REVISION) {
    fail(`protocol_revision 必须是 ${PROTOCOL_REVISION}`);
  }
  const protocol = validateProtocol(manifest.protocol);
  const participant = validateParticipant(manifest.participant);
  const runDate = requireString(manifest.run_date, CALENDAR_DATE_PATTERN, "run_date");
  if (!isRealCalendarDate(runDate)) fail("run_date 必须是真实存在的 YYYY-MM-DD 日期");
  if (!Array.isArray(manifest.trials) || manifest.trials.length !== TRIAL_COUNT) {
    fail(`trials 必须恰好包含 ${TRIAL_COUNT} 个轮次`);
  }
  const trials = manifest.trials.map(validateTrial).sort((left, right) => left.round - right.round);
  const rounds = new Set(trials.map((trial) => trial.round));
  if (rounds.size !== TRIAL_COUNT) fail("trials.round 不可重复，且必须完整覆盖 1–10");
  const evidence = new Set(trials.map((trial) => trial.evidence_sha256));
  if (evidence.size !== TRIAL_COUNT) fail("每个轮次必须使用不同的 evidence_sha256");
  return { protocol, participant, runDate, trials };
}

function buildResult(validated, manifestDigest) {
  const score = roundTwo(
    validated.trials.reduce((total, trial) => total + trial.score, 0) / TRIAL_COUNT,
  );
  const scored = validated.trials.filter((trial) => trial.status === "scored").length;
  const failures = TRIAL_COUNT - scored;
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
          label: "10 轮平均分",
          value: `${score.toFixed(2)} 分`,
        },
        detail:
          `固定 graph-engineering-v2 协议运行 ${TRIAL_COUNT} 轮：${scored} 轮完成评分，` +
          `${failures} 轮失败、超时或无产物并按 0 计。` +
          `OpenCode ${OPENCODE_VERSION}；Playwright ${PLAYWRIGHT_VERSION}；scorer ${SCORER_VERSION}。` +
          `提交清单 sha256=${manifestDigest}。转换成功只代表结构和固定协议字段合规，成绩仍须作者核对原始证据。`,
        supplementary_views: [
          {
            type: "metric_table",
            id: "run-final-summary",
            label: "最终汇总",
            title: "本次运行的最终汇总结果",
            columns: ["最终平均分", "有效评分数", "记零数", "提交清单 sha256"],
            rows: [{ cells: [score, scored, failures, manifestDigest] }],
            note: "只展示按固定协议聚合后的最终结果与整包摘要，不展示单轮分数或中间运行信息。辅助展示，不参与独立排名。",
          },
        ],
      },
    ],
  };
}

function loadEvalDefinition() {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(resolve(here, "eval.yaml"), "utf8");
  const parsed = EvalDefSchema.safeParse(parseYaml(source));
  if (!parsed.success) fail(`eval.yaml 校验失败：${parsed.error.message}`);
  return parsed.data;
}

function validateEnvelope(result) {
  const structural = ResultFileSchema.safeParse(result);
  if (!structural.success) fail(`结果信封结构校验失败：${structural.error.message}`);
  const semantic = validateResultForEval(loadEvalDefinition(), structural.data);
  if (!semantic.success) fail(`结果信封协议校验失败：${semantic.error.message}`);
  return semantic.data;
}

function writeAtomic(outputPath, value) {
  const temporary = resolve(dirname(outputPath), `.${basename(outputPath)}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporary, outputPath);
  } catch (error) {
    fail(`无法写出结果文件：${error.message}`);
  }
}

try {
  const { input, output } = parseArgv(process.argv.slice(2));
  const { manifest, digest } = readManifest(input);
  const validated = validateManifest(manifest);
  writeAtomic(output, validateEnvelope(buildResult(validated, digest)));
  console.log(`wrote ${output}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`zangai-bench pack failed: ${message}`);
  process.exitCode = 1;
}
