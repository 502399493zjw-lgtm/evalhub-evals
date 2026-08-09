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

const EVAL_ID = "mg-animation-replication";
const TASK_ID = "mg-animation-image-creative-v2-20260803";
const PROTOCOL_REVISION = 1;
const RUNNER_VERSION = "mg-animation-replication/pack-to-result@1.0.0";
const MAX_BYTES = 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const IDENTITY = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;
const ARTIFACT_KEYS = Object.freeze([
  "video_mp4_sha256",
  "run_log_sha256",
  "run_metadata_sha256",
  "validator_report_sha256",
]);

class PackError extends Error {}

function fail(message) {
  throw new PackError(message);
}

function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} 必须是 JSON 对象`);
  }
  return value;
}

function onlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(`${label} 含未知字段 ${JSON.stringify(key)}`);
  }
}

function string(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) fail(`${label} 缺失或格式不合法`);
  return value;
}

function realDate(value) {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function httpsUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} 必须是合法 HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) {
    fail(`${label} 必须是无凭证 HTTPS URL`);
  }
  return value;
}

function parseArgv(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") {
    fail("用法：node evals/mg-animation-replication/pack-to-result.mjs <submission.json> --out <result.json>");
  }
  if (!argv[0] || !argv[2]?.endsWith(".json")) fail("输入和输出路径不合法");
  return { input: resolve(argv[0]), output: resolve(argv[2]) };
}

function readManifest(input) {
  let stats;
  try {
    stats = statSync(input);
  } catch (error) {
    fail(`无法读取提交清单：${error.message}`);
  }
  if (!stats.isFile() || stats.size > MAX_BYTES) fail("提交清单必须是小于等于 1 MiB 的普通文件");
  const source = readFileSync(input, "utf8");
  try {
    return { value: JSON.parse(source), digest: createHash("sha256").update(source).digest("hex") };
  } catch (error) {
    fail(`提交清单不是合法 JSON：${error.message}`);
  }
}

function validateParticipant(raw) {
  const value = object(raw, "participant");
  onlyKeys(value, ["model", "harness", "harness_version"], "participant");
  return {
    model: string(value.model, IDENTITY, "participant.model"),
    harness: string(value.harness, IDENTITY, "participant.harness"),
    harness_version: string(value.harness_version, IDENTITY, "participant.harness_version"),
  };
}

function validateManifest(raw) {
  const value = object(raw, "提交清单");
  onlyKeys(value, ["manifest_version", "eval_id", "protocol_revision", "task_id", "participant", "run_date", "artifacts_url", "artifacts"], "提交清单");
  if (value.manifest_version !== 1) fail("manifest_version 必须是 1");
  if (value.eval_id !== EVAL_ID) fail(`eval_id 必须是 ${EVAL_ID}`);
  if (value.protocol_revision !== PROTOCOL_REVISION) fail(`protocol_revision 必须是 ${PROTOCOL_REVISION}`);
  if (value.task_id !== TASK_ID) fail(`task_id 必须是 ${TASK_ID}`);
  if (!realDate(value.run_date)) fail("run_date 必须是 YYYY-MM-DD 形式的真实日期");
  const artifactsUrl = httpsUrl(value.artifacts_url, "artifacts_url");
  const artifacts = object(value.artifacts, "artifacts");
  onlyKeys(artifacts, ARTIFACT_KEYS, "artifacts");
  for (const key of ARTIFACT_KEYS) string(artifacts[key], SHA256, `artifacts.${key}`);
  return { participant: validateParticipant(value.participant), runDate: value.run_date, artifactsUrl, artifacts };
}

function loadEval() {
  const yamlPath = resolve(dirname(fileURLToPath(import.meta.url)), "eval.yaml");
  const parsed = EvalDefSchema.safeParse(parseYaml(readFileSync(yamlPath, "utf8")));
  if (!parsed.success) fail(`eval.yaml 不合法：${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  return parsed.data;
}

function buildEnvelope(manifest, digest) {
  const evidence = ARTIFACT_KEYS.map((key) => `${key}=${manifest.artifacts[key]}`).join("；");
  return {
    eval_id: EVAL_ID,
    submission: { kind: "run", runner_version: RUNNER_VERSION, run_date: manifest.runDate },
    results: [{
      participant: manifest.participant,
      score: null,
      raw_metric: { label: "作者复核状态", value: "待复核" },
      detail: `产物地址：${manifest.artifactsUrl}。${evidence}；提交清单 sha256=${digest}。转换器不自行评分；作者复验媒体规格并完成七项人工评审后才认可总分。`,
    }],
  };
}

function writeAtomic(output, value) {
  const temporary = resolve(dirname(output), `.${basename(output)}.partial`);
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporary, output);
}

function main(argv) {
  const { input, output } = parseArgv(argv);
  const { value, digest } = readManifest(input);
  const manifest = validateManifest(value);
  const envelope = buildEnvelope(manifest, digest);
  const generic = ResultFileSchema.safeParse(envelope);
  if (!generic.success) fail(`生成结果结构不合法：${generic.error.issues.map((issue) => issue.message).join("; ")}`);
  const contextual = validateResultForEval(loadEval(), generic.data);
  if (!contextual.success) fail(`生成结果不符合本评测：${contextual.error.issues.map((issue) => issue.message).join("; ")}`);
  writeAtomic(output, generic.data);
  console.log(`${EVAL_ID}: ${manifest.participant.harness} / ${manifest.participant.model} 已登记，等待作者复核`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`${EVAL_ID} 转换失败：${error.message}`);
  process.exitCode = 1;
}
