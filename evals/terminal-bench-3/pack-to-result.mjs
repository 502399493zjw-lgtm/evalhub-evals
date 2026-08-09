/**
 * Terminal-Bench 3.0（FrontierBench v0.1）external-workflow 转换器。
 *
 * 这个基准必须在 Harbor + 付费云沙箱（Modal / Daytona）上跑，74 题里还有需要 GPU 的题，
 * 所以 EvalHub 侧不执行评测本身：参赛方在自己的基础设施上按上游协议跑完，把逐题判定
 * 整理成一份提交清单，再由本转换器换算成结果信封。
 *
 * 转换器刻意不联网、不起子进程、不读环境变量、不调用任何模型服务，只做三件事：
 * 校验清单、按内置分母算分、原子写出通过 schema 自校验的信封。
 */
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

const EVAL_ID = "terminal-bench-3";
const RUNNER_VERSION = "terminal-bench-3/pack-to-result@1.0.0";
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "2b0442c3c583b710ca8da14c8e601b99f2f1f244";
const UPSTREAM_DATASET = "frontier-bench/frontier-bench";
/** 74 是钉死在 tag v3.0.0 的题数，由 tasks/ 目录点算，不接受提交方覆盖。 */
const TASK_COUNT = 74;

const MANIFEST_MAX_BYTES = 1024 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const TASK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const JOB_ID_PATTERN = /^[A-Za-z0-9._:/-]{3,200}$/u;
const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._/:+-]{1,254}$/u;
const IDENTITY_TEXT_PATTERN = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const MANIFEST_KEYS = Object.freeze([
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "upstream_commit",
  "upstream_dataset",
  "participant",
  "run_date",
  "harbor_job",
  "tasks",
]);
const PARTICIPANT_KEYS = Object.freeze(["model", "harness", "harness_version"]);
const HARBOR_JOB_KEYS = Object.freeze(["job_id", "evidence_sha256"]);
const TASK_KEYS = Object.freeze(["task_id", "passed", "verifier_separate"]);

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
    fail(
      "用法：node evals/terminal-bench-3/pack-to-result.mjs <submission.json> --out <result.json>",
    );
  }
  const [input, , output] = argv;
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
    return {
      manifest: JSON.parse(source),
      digest: createHash("sha256").update(source).digest("hex"),
    };
  } catch (error) {
    fail(`提交清单不是合法 JSON：${error.message}`);
  }
}

function validateParticipant(raw) {
  const participant = plainObject(raw, "participant");
  onlyKnownKeys(participant, PARTICIPANT_KEYS, "participant");
  const model = requireString(
    participant.model,
    MODEL_ID_PATTERN,
    "participant.model",
  );
  const harness = requireString(
    participant.harness,
    IDENTITY_TEXT_PATTERN,
    "participant.harness",
  );
  const result = { model, harness };
  // 真实运行的信封里 harness 与 harness_version 必须成对出现（只有上游发表豁免），
  // 所以这里把版本也设为必填，而不是让 schema 在写盘前才报错。
  result.harness_version = requireString(
    participant.harness_version,
    IDENTITY_TEXT_PATTERN,
    "participant.harness_version",
  );
  return result;
}

/** 逐题只接受二元判定：上游 reward = 1.0 记 true，其余一律 false，没有部分分。 */
function validateTaskEntry(raw, index, expectedIds, seen) {
  const entry = plainObject(raw, `tasks[${index}]`);
  onlyKnownKeys(entry, TASK_KEYS, `tasks[${index}]`);
  const taskId = requireString(
    entry.task_id,
    TASK_ID_PATTERN,
    `tasks[${index}].task_id`,
  );
  if (!expectedIds.has(taskId)) {
    fail(
      `tasks[${index}].task_id ${JSON.stringify(taskId)} 不是本评测钉死的 74 个任务之一`,
    );
  }
  if (seen.has(taskId)) {
    fail(`tasks：任务 ${taskId} 重复提交`);
  }
  seen.add(taskId);
  if (typeof entry.passed !== "boolean") {
    fail(
      `tasks[${index}].passed 必须是布尔值：上游 reward = 1.0 记 true，其余一律 false，不接受部分分`,
    );
  }
  if (entry.verifier_separate !== true) {
    fail(
      `tasks[${index}]：判分必须在与 Agent 隔离的独立 verifier 容器内完成，verifier_separate 只接受 true`,
    );
  }
  return { taskId, passed: entry.passed };
}

function validateManifest(raw, evalTaskIds) {
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
    fail("upstream_commit 必须是本评测钉死的上游 commit");
  }
  if (manifest.upstream_dataset !== UPSTREAM_DATASET) {
    fail(`upstream_dataset 必须是 ${UPSTREAM_DATASET}`);
  }
  const runDate = requireString(
    manifest.run_date,
    CALENDAR_DATE_PATTERN,
    "run_date",
  );
  if (!isRealCalendarDate(runDate)) {
    fail("run_date 必须是真实存在的日期");
  }
  const participant = validateParticipant(manifest.participant);
  const job = plainObject(manifest.harbor_job, "harbor_job");
  onlyKnownKeys(job, HARBOR_JOB_KEYS, "harbor_job");
  requireString(job.job_id, JOB_ID_PATTERN, "harbor_job.job_id");
  requireString(
    job.evidence_sha256,
    SHA256_PATTERN,
    "harbor_job.evidence_sha256",
  );

  if (!Array.isArray(manifest.tasks) || manifest.tasks.length !== TASK_COUNT) {
    fail(
      `tasks 必须是长度为 ${TASK_COUNT} 的数组：74 道题每题一条判定，缺题不补、不豁免`,
    );
  }
  const seen = new Set();
  const entries = manifest.tasks.map((entry, index) =>
    validateTaskEntry(entry, index, evalTaskIds, seen),
  );
  if (seen.size !== TASK_COUNT) {
    fail(`tasks 必须覆盖全部 ${TASK_COUNT} 个任务 ID，当前只覆盖 ${seen.size} 个`);
  }
  return { participant, runDate, job, entries };
}

function scoreEntries(entries) {
  const passedCount = entries.filter((entry) => entry.passed).length;
  const score = roundSix((passedCount / TASK_COUNT) * 100);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    fail("通过率越界，拒绝写出结果");
  }
  return { passedCount, score };
}

function domainRows(entries, evalTasks) {
  // 域取自 eval.yaml 的 label 前缀（`域 · 子域 · slug`），与上游 task.toml 的 category 一致。
  const labelById = new Map(evalTasks.map((task) => [task.id, task.label ?? ""]));
  const buckets = new Map();
  for (const entry of entries) {
    const domain = String(labelById.get(entry.taskId)).split(" · ")[0] || "未分域";
    const bucket = buckets.get(domain) ?? { total: 0, passed: 0 };
    bucket.total += 1;
    if (entry.passed) bucket.passed += 1;
    buckets.set(domain, bucket);
  }
  return [...buckets.entries()]
    .sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]))
    .map(([domain, bucket]) => ({
      cells: [
        domain,
        bucket.total,
        bucket.passed,
        roundSix((bucket.passed / bucket.total) * 100),
      ],
    }));
}

function buildEnvelope({
  participant,
  runDate,
  entries,
  passedCount,
  score,
  job,
  manifestDigest,
  evalTasks,
}) {
  return {
    eval_id: EVAL_ID,
    submission: { kind: "run", runner_version: RUNNER_VERSION, run_date: runDate },
    results: [
      {
        participant,
        score,
        raw_metric: {
          label: "74 题通过率",
          value: `${passedCount}/${TASK_COUNT}`,
          tiebreak_value: score,
        },
        detail: [
          `在钉死的上游 tag v3.0.0（commit ${UPSTREAM_COMMIT}）全部 ${TASK_COUNT} 道题上各跑一次，`,
          `数据集 ${UPSTREAM_DATASET}，Harbor job ${job.job_id}。`,
          `主分数 = 通过题数 ÷ ${TASK_COUNT} × 100 = ${passedCount} ÷ ${TASK_COUNT} × 100 = ${score}。`,
          "每题为二元判定，由与 Agent 隔离的独立 verifier 容器给出，不给部分分、不因超时或环境失败豁免。",
          `证据指纹 ${job.evidence_sha256}，提交清单 sha256=${manifestDigest}。题数与分母由转换器内置，不接受提交方覆盖。`,
        ].join(""),
        task_results: entries.map((entry) => ({
          task_id: entry.taskId,
          score: entry.passed ? 100 : 0,
          raw: entry.passed ? "pass" : "fail",
        })),
        supplementary_views: [
          {
            type: "metric_table",
            id: "run-domain-breakdown",
            label: "本次分域",
            title: "本次运行的分域通过情况",
            columns: ["域", "题数", "通过题数", "通过率"],
            rows: domainRows(entries, evalTasks),
            note: "分域统计由转换器按 eval.yaml 里每题的域标注确定性汇总，仅解释主分数，不参与排名；上游官方榜单不发表分域成绩。",
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
    fail(
      `eval.yaml 不合法：${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  if (parsed.data.tasks.length !== TASK_COUNT) {
    fail(
      `eval.yaml 声明了 ${parsed.data.tasks.length} 道题，与内置分母 ${TASK_COUNT} 不一致，拒绝给分`,
    );
  }
  return parsed.data;
}

function writeAtomic(outputPath, envelope) {
  const temporaryPath = resolve(
    dirname(outputPath),
    `.${basename(outputPath)}.partial`,
  );
  writeFileSync(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, outputPath);
}

function main(argv) {
  const { input, output } = parseArgv(argv);
  const definition = loadEvalDefinition();
  const evalTaskIds = new Set(definition.tasks.map((task) => task.id));
  const { manifest, digest } = readManifest(input);
  const { participant, runDate, job, entries } = validateManifest(
    manifest,
    evalTaskIds,
  );
  const { passedCount, score } = scoreEntries(entries);
  const envelope = buildEnvelope({
    participant,
    runDate,
    entries,
    passedCount,
    score,
    job,
    manifestDigest: digest,
    evalTasks: definition.tasks,
  });
  const generic = ResultFileSchema.safeParse(envelope);
  if (!generic.success) {
    fail(
      `生成的结果不符合结果结构：${generic.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const contextual = validateResultForEval(definition, generic.data);
  if (!contextual.success) {
    fail(
      `生成的结果不符合本评测契约：${contextual.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  writeAtomic(output, generic.data);
  console.log(
    `${EVAL_ID}: ${participant.harness} / ${participant.model} = ${score} 分（${passedCount}/${TASK_COUNT}）`,
  );
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`terminal-bench-3 转换失败：${error.message}`);
  process.exitCode = 1;
}
