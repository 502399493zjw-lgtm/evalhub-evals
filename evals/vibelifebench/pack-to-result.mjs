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

const EVAL_ID = "vibelifebench";
const RUNNER_VERSION = "vibelifebench/pack-to-result@1.0.0";
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "60a042e405377b89b3b00a99a45fb38039f13013";
const PAPER_VERSION = "arXiv:2608.10875v2";
const MANIFEST_MAX_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._/:+-]{4,255}$/u;
const IDENTITY_TEXT_PATTERN = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const DOMAIN_LABELS = Object.freeze({
  career: "Career",
  exam_preparation: "Exam preparation",
  finance: "Finance",
  fitness: "Fitness",
  litigation: "Litigation",
  renovation: "Renovation",
  rental: "Rental",
  shopping: "Shopping",
  team_building: "Team building",
  travel: "Travel",
});

const CHECK_LABELS = Object.freeze({
  per_stage: "Per-stage",
  cross_stage: "Cross-stage",
  final: "Final",
  proactivity: "Proactivity",
  propagation_and_recovery: "Propagation and recovery",
  persistence_and_bookkeeping: "Persistence and bookkeeping",
  safety_and_privacy: "Safety and privacy",
  authorization_boundary: "Authorization boundary",
});

const TOP_LEVEL_KEYS = Object.freeze([
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "upstream_commit",
  "paper_version",
  "benchmark_scope",
  "participant",
  "run_date",
  "author_review",
  "scores",
]);
const SCOPE_KEYS = Object.freeze(["task_count", "domain_count", "attempts_per_task"]);
const PARTICIPANT_KEYS = Object.freeze(["model", "harness", "harness_version"]);
const REVIEW_KEYS = Object.freeze([
  "upstream_author_reviewed",
  "evidence_url",
  "evidence_sha256",
]);
const SCORE_KEYS = Object.freeze([
  "avg_at_3",
  "max_at_3",
  "min_at_3",
  "mean_within_task_sigma",
  "domain_avg_at_3",
  "check_pass_rates",
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

function exactKeys(value, keys, label) {
  onlyKnownKeys(value, keys, label);
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) {
      fail(`${label} 缺少字段 ${JSON.stringify(key)}`);
    }
  }
}

function requireString(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${label} 缺失或格式不合法`);
  }
  return value;
}

function requireScore(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    fail(`${label} 必须是 0 到 100 之间的有限数值`);
  }
  return value;
}

function requireHttpsUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} 必须是合法 URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    fail(`${label} 必须是不含凭据的 HTTPS URL`);
  }
  return parsed.toString();
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
    fail("用法：node evals/vibelifebench/pack-to-result.mjs <submission.json> --out <result.json>");
  }
  if (typeof argv[0] !== "string" || argv[0].length === 0) {
    fail("缺少提交清单路径");
  }
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
    return {
      manifest: JSON.parse(source),
      digest: createHash("sha256").update(source).digest("hex"),
    };
  } catch (error) {
    fail(`提交清单不是合法 JSON：${error.message}`);
  }
}

function validateMetricMap(raw, labels, label) {
  const value = plainObject(raw, label);
  const keys = Object.keys(labels);
  exactKeys(value, keys, label);
  return Object.fromEntries(keys.map((key) => [key, requireScore(value[key], `${label}.${key}`)]));
}

function validateManifest(raw) {
  const manifest = plainObject(raw, "提交清单");
  exactKeys(manifest, TOP_LEVEL_KEYS, "提交清单");
  if (manifest.manifest_version !== 1) fail("manifest_version 目前只支持 1");
  if (manifest.eval_id !== EVAL_ID) fail(`eval_id 必须是 ${EVAL_ID}`);
  if (manifest.protocol_revision !== PROTOCOL_REVISION) {
    fail(`protocol_revision 必须是 ${PROTOCOL_REVISION}`);
  }
  if (manifest.upstream_commit !== UPSTREAM_COMMIT) {
    fail("upstream_commit 必须是本评测钉死的来源 commit");
  }
  if (manifest.paper_version !== PAPER_VERSION) {
    fail(`paper_version 必须是 ${PAPER_VERSION}`);
  }

  const scope = plainObject(manifest.benchmark_scope, "benchmark_scope");
  exactKeys(scope, SCOPE_KEYS, "benchmark_scope");
  if (scope.task_count !== 200 || scope.domain_count !== 10 || scope.attempts_per_task !== 3) {
    fail("benchmark_scope 必须严格声明 200 题、10 领域、每题 3 次运行");
  }

  const participant = plainObject(manifest.participant, "participant");
  exactKeys(participant, PARTICIPANT_KEYS, "participant");
  const normalizedParticipant = {
    model: requireString(participant.model, MODEL_ID_PATTERN, "participant.model"),
    harness: requireString(participant.harness, IDENTITY_TEXT_PATTERN, "participant.harness"),
    harness_version: requireString(
      participant.harness_version,
      IDENTITY_TEXT_PATTERN,
      "participant.harness_version",
    ),
  };

  const runDate = requireString(manifest.run_date, CALENDAR_DATE_PATTERN, "run_date");
  if (!isRealCalendarDate(runDate)) fail("run_date 不是实际存在的日历日期");

  const review = plainObject(manifest.author_review, "author_review");
  exactKeys(review, REVIEW_KEYS, "author_review");
  if (review.upstream_author_reviewed !== true) {
    fail("author_review.upstream_author_reviewed 只接受 true；未获上游作者审核的报告不能打包");
  }
  const evidenceUrl = requireHttpsUrl(review.evidence_url, "author_review.evidence_url");
  const evidenceSha256 = requireString(
    review.evidence_sha256,
    SHA256_PATTERN,
    "author_review.evidence_sha256",
  );

  const scores = plainObject(manifest.scores, "scores");
  exactKeys(scores, SCORE_KEYS, "scores");
  const avgAt3 = requireScore(scores.avg_at_3, "scores.avg_at_3");
  const maxAt3 = requireScore(scores.max_at_3, "scores.max_at_3");
  const minAt3 = requireScore(scores.min_at_3, "scores.min_at_3");
  const sigma = requireScore(
    scores.mean_within_task_sigma,
    "scores.mean_within_task_sigma",
  );
  if (minAt3 > avgAt3 || avgAt3 > maxAt3) {
    fail("scores 必须满足 min_at_3 <= avg_at_3 <= max_at_3");
  }
  const domains = validateMetricMap(scores.domain_avg_at_3, DOMAIN_LABELS, "scores.domain_avg_at_3");
  const checks = validateMetricMap(scores.check_pass_rates, CHECK_LABELS, "scores.check_pass_rates");

  return {
    participant: normalizedParticipant,
    runDate,
    evidenceUrl,
    evidenceSha256,
    avgAt3,
    maxAt3,
    minAt3,
    sigma,
    domains,
    checks,
  };
}

function buildEnvelope(validated, manifestDigest) {
  const {
    participant,
    runDate,
    evidenceUrl,
    evidenceSha256,
    avgAt3,
    maxAt3,
    minAt3,
    sigma,
    domains,
    checks,
  } = validated;
  return {
    eval_id: EVAL_ID,
    submission: {
      kind: "run",
      runner_version: RUNNER_VERSION,
      run_date: runDate,
    },
    results: [
      {
        participant,
        score: avgAt3,
        raw_metric: {
          label: "完整 200 题 avg@3",
          value: `${avgAt3} 分`,
        },
        detail: [
          `完整 200 题、10 领域、每题 3 次运行；主分数直接采用上游作者审核报告的 avg@3=${avgAt3}。`,
          `来源固定为 ${PAPER_VERSION} 与 commit ${UPSTREAM_COMMIT}。`,
          `报告证据 ${evidenceUrl}，evidence_sha256=${evidenceSha256}；提交清单 sha256=${manifestDigest}。`,
          "该转换器不运行 benchmark，也不把公开 20 题子集的结果当成完整集成绩。",
        ].join(" "),
        supplementary_views: [
          {
            type: "metric_table",
            id: "run-aggregate-metrics",
            label: "汇总指标",
            title: "完整 200 题三次运行汇总",
            columns: ["avg@3", "max@3", "min@3", "平均题内标准差"],
            rows: [{ cells: [avgAt3, maxAt3, minAt3, sigma] }],
            note: "四项均来自上游作者审核报告；只有 avg@3 进入 EvalHub 主排名。",
          },
          {
            type: "metric_table",
            id: "run-domain-breakdown",
            label: "领域分数",
            title: "完整 200 题十领域 avg@3",
            columns: ["领域", "avg@3"],
            rows: Object.entries(DOMAIN_LABELS).map(([key, label]) => ({
              cells: [label, domains[key]],
            })),
            note: "每个领域含 20 题；这些是辅助展示，不单独参与排名。",
          },
          {
            type: "metric_table",
            id: "run-check-pass-rates",
            label: "检查通过率",
            title: "检查类型与能力维度通过率",
            columns: ["检查组", "通过率（%）"],
            rows: Object.entries(CHECK_LABELS).map(([key, label]) => ({
              cells: [label, checks[key]],
            })),
            note: "通过率来自同一完整集报告，只解释错误结构，不参与主排名。",
          },
        ],
      },
    ],
  };
}

function loadEvalDefinition() {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(resolve(currentDirectory, "eval.yaml"), "utf8");
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
  const validated = validateManifest(manifest);
  const envelope = buildEnvelope(validated, digest);
  const generic = ResultFileSchema.safeParse(envelope);
  if (!generic.success) {
    fail(`生成的结果不符合结果结构：${generic.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  const contextual = validateResultForEval(loadEvalDefinition(), generic.data);
  if (!contextual.success) {
    fail(`生成的结果不符合本评测契约：${contextual.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  writeAtomic(output, generic.data);
  console.log(`${EVAL_ID}: ${validated.participant.model} = ${roundSix(validated.avgAt3)} 分`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`vibelifebench 转换失败：${error.message}`);
  process.exitCode = 1;
}
