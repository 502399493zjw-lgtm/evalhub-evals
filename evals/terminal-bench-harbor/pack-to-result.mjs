import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const EVAL_ID = "terminal-bench-harbor";
const RUNNER_VERSION = "terminal-bench-harbor/pack-to-result@1.0.0";
const SCHEMA_VERSION = "1.0";
const DATASET_ID = "terminal-bench@2.1";
const REQUIRED_RUNS = 3;
const MANIFEST_MAX_BYTES = 1024 * 1024;
const EVAL_COMMIT_PATTERN = /^[a-f0-9]{7,40}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._/:+-]+$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]{3,128}$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const MIN_TOTAL_TASKS = 1;
const MAX_TOTAL_TASKS = 10_000;

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

function assert(condition, message) {
  if (!condition) throw new InputError(message);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, required, optional, label) {
  assert(isRecord(value), `${label} 必须是 JSON object`);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    assert(allowed.has(key), `${label} 不支持字段 ${key}`);
  }
  for (const key of required) {
    assert(
      Object.prototype.hasOwnProperty.call(value, key),
      `${label} 缺少字段 ${key}`,
    );
  }
}

function nonEmptyString(value, label, maxLength = 2048) {
  assert(typeof value === "string", `${label} 必须是字符串`);
  assert(value.trim() === value && value.length > 0, `${label} 不能为空或带首尾空格`);
  assert(value.length <= maxLength, `${label} 最长 ${maxLength} 个字符`);
  assert(!CONTROL_CHARACTERS.test(value), `${label} 不能包含控制字符`);
  return value;
}

function validateSafeId(value, label, maxLength = 255) {
  const text = nonEmptyString(value, label, maxLength);
  assert(SAFE_ID_PATTERN.test(text), `${label} 只能包含 ASCII 字母、数字和 ._/:+-`);
  return text;
}

function validateCalendarDate(value, label) {
  const text = nonEmptyString(value, label, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(text);
  assert(match !== null, `${label} 必须是 YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  assert(
    year >= 1 &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day,
    `${label} 必须是真实公历日期`,
  );
  return text;
}

function validateParticipant(value) {
  exactKeys(
    value,
    ["model", "harness", "harness_version", "config"],
    [],
    "participant",
  );
  exactKeys(value.config, ["provider", "reasoning_effort"], [], "participant.config");
  const model = validateSafeId(value.model, "participant.model");
  assert(
    model.includes("/") && !model.startsWith("/") && !model.endsWith("/"),
    "participant.model 必须包含 provider 命名空间",
  );
  const harness = validateSafeId(value.harness, "participant.harness");
  const harnessVersion = validateSafeId(
    value.harness_version,
    "participant.harness_version",
  );
  const provider = validateSafeId(value.config.provider, "participant.config.provider", 128);
  const reasoningEffort = validateSafeId(
    value.config.reasoning_effort,
    "participant.config.reasoning_effort",
    64,
  );
  assert(
    model.split("/", 1)[0] === provider,
    "participant.model 的 provider 命名空间必须与 participant.config.provider 一致",
  );
  return {
    model,
    harness,
    harness_version: harnessVersion,
    config: { provider, reasoning_effort: reasoningEffort },
  };
}

function validateProtocol(value) {
  exactKeys(
    value,
    ["dataset", "harbor_version", "environment"],
    [],
    "protocol",
  );
  assert(value.dataset === DATASET_ID, `protocol.dataset 必须是 ${DATASET_ID}`);
  const harborVersion = validateSafeId(value.harbor_version, "protocol.harbor_version", 64);
  const environment = validateSafeId(value.environment, "protocol.environment", 64);
  return { dataset: DATASET_ID, harbor_version: harborVersion, environment };
}

function isIpLiteral(hostname) {
  if (hostname.startsWith("[") && hostname.endsWith("]")) return true;
  const octets = hostname.split(".");
  return (
    octets.length === 4 &&
    octets.every(
      (octet) => /^(?:0|[1-9]\d{0,2})$/u.test(octet) && Number(octet) <= 255,
    )
  );
}

function validateHttpsArtifactUrl(value, label) {
  const text = nonEmptyString(value, label, 2048);
  let url;
  try {
    url = new URL(text);
  } catch (error) {
    throw new InputError(`${label} 不是合法 URL：${error.message}`);
  }
  assert(url.protocol === "https:", `${label} 必须使用 https`);
  assert(url.username === "" && url.password === "", `${label} 不能内嵌用户名或密码`);
  assert(url.port === "", `${label} 不能使用自定义端口`);
  assert(url.search === "", `${label} 不能包含 query 参数或临时签名`);
  assert(url.hash === "", `${label} 不能包含 fragment`);
  const hostname = url.hostname.toLowerCase();
  assert(!hostname.endsWith("."), `${label} 主机名不能以点结尾`);
  assert(
    hostname.includes(".") &&
      hostname !== "localhost" &&
      !hostname.endsWith(".localhost") &&
      !hostname.endsWith(".local") &&
      !isIpLiteral(hostname),
    `${label} 必须指向公开主机`,
  );
  return url.toString();
}

function validateSha256(value, label) {
  const hash = nonEmptyString(value, label, 64);
  assert(SHA256_PATTERN.test(hash), `${label} 必须是 64 位小写十六进制 SHA-256`);
  return hash;
}

function validateRun(value, index) {
  const label = `runs[${index}]`;
  exactKeys(
    value,
    [
      "run_id",
      "resolved_tasks",
      "total_tasks",
      "artifact_url",
      "harbor_run_sha256",
    ],
    [],
    label,
  );
  const runId = nonEmptyString(value.run_id, `${label}.run_id`, 128);
  assert(RUN_ID_PATTERN.test(runId), `${label}.run_id 只能包含字母、数字和 ._-`);
  assert(
    Number.isSafeInteger(value.total_tasks) &&
      value.total_tasks >= MIN_TOTAL_TASKS &&
      value.total_tasks <= MAX_TOTAL_TASKS,
    `${label}.total_tasks 必须是 ${MIN_TOTAL_TASKS} 至 ${MAX_TOTAL_TASKS} 的安全整数`,
  );
  assert(
    Number.isSafeInteger(value.resolved_tasks) &&
      value.resolved_tasks >= 0 &&
      value.resolved_tasks <= value.total_tasks,
    `${label}.resolved_tasks 必须是 0 至 total_tasks 的安全整数`,
  );
  return {
    artifactUrl: validateHttpsArtifactUrl(value.artifact_url, `${label}.artifact_url`),
    harborRunSha256: validateSha256(value.harbor_run_sha256, `${label}.harbor_run_sha256`),
    resolvedTasks: value.resolved_tasks,
    runId,
    totalTasks: value.total_tasks,
  };
}

function validateRuns(value) {
  assert(Array.isArray(value), "runs 必须是数组");
  assert(value.length === REQUIRED_RUNS, `runs 必须恰好包含 ${REQUIRED_RUNS} 项`);
  const runs = value.map((run, index) => validateRun(run, index));
  const runIds = new Set(runs.map((run) => run.runId));
  assert(runIds.size === runs.length, `${REQUIRED_RUNS} 次运行必须使用不同 run_id`);
  const artifactUrls = new Set(runs.map((run) => run.artifactUrl));
  assert(artifactUrls.size === runs.length, `${REQUIRED_RUNS} 次运行必须使用不同 artifact_url`);
  const hashes = new Set(runs.map((run) => run.harborRunSha256));
  assert(hashes.size === runs.length, `${REQUIRED_RUNS} 份 Harbor 输出必须使用不同 SHA-256`);
  const totals = new Set(runs.map((run) => run.totalTasks));
  assert(
    totals.size === 1,
    `${REQUIRED_RUNS} 次运行的 total_tasks 必须一致，否则分母不可比`,
  );
  return runs;
}

function parseArgs(argv) {
  const parsed = { manifest: null, out: null, evalCommit: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out" || token === "--eval-commit") {
      assert(!seen.has(token), `参数 ${token} 不能重复`);
      seen.add(token);
      const value = argv[index + 1];
      assert(value !== undefined && !value.startsWith("--"), `参数 ${token} 缺少值`);
      if (token === "--out") parsed.out = value;
      else parsed.evalCommit = value;
      index += 1;
      continue;
    }
    assert(!token.startsWith("-"), `未知参数 ${token}`);
    assert(parsed.manifest === null, `多余位置参数 ${token}`);
    parsed.manifest = token;
  }
  assert(
    parsed.manifest !== null && parsed.out !== null,
    "用法：node pack-to-result.mjs <submission.json> --out <result.json> [--eval-commit <sha>]",
  );
  if (parsed.evalCommit !== null) {
    assert(
      EVAL_COMMIT_PATTERN.test(parsed.evalCommit),
      "--eval-commit 必须是 7-40 位小写十六进制 Git commit",
    );
  }
  return parsed;
}

function parseManifest(filePath) {
  let metadata;
  try {
    metadata = lstatSync(filePath);
  } catch (error) {
    throw new InputError(`submission.json 无法读取：${error.message}`);
  }
  assert(metadata.isFile(), "submission.json 必须是普通文件，不能是目录或符号链接");
  assert(
    metadata.size <= MANIFEST_MAX_BYTES,
    `submission.json 超过 ${MANIFEST_MAX_BYTES} bytes`,
  );
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new InputError(`submission.json 不是合法 JSON：${error.message}`);
  }
}

function roundSix(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function displayNumber(value) {
  return value.toFixed(6).replace(/\.?0+$/u, "");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function buildResult(manifest, evalCommit) {
  const perRun = manifest.runs.map((run) => ({
    run,
    percent: roundSix((run.resolvedTasks / run.totalTasks) * 100),
  }));
  const mean = roundSix(
    perRun.reduce((sum, entry) => sum + entry.percent, 0) / perRun.length,
  );
  const totalTasks = manifest.runs[0].totalTasks;
  const evidenceFingerprint = sha256Text(
    JSON.stringify({
      dataset: DATASET_ID,
      runs: manifest.runs.map((run) => ({
        artifact_url: run.artifactUrl,
        harbor_run_sha256: run.harborRunSha256,
        resolved_tasks: run.resolvedTasks,
        run_id: run.runId,
        total_tasks: run.totalTasks,
      })),
    }),
  );

  return {
    eval_id: EVAL_ID,
    ...(evalCommit === null ? {} : { eval_commit: evalCommit }),
    submission: {
      kind: "run",
      runner_version: RUNNER_VERSION,
      run_date: manifest.runDate,
    },
    results: [
      {
        participant: {
          model: manifest.participant.model,
          harness: manifest.participant.harness,
          harness_version: manifest.participant.harness_version,
          config: {
            ...manifest.participant.config,
            dataset: DATASET_ID,
            harbor_version: manifest.protocol.harbor_version,
            environment: manifest.protocol.environment,
            runs: REQUIRED_RUNS,
            total_tasks_per_run: totalTasks,
            evidence_fingerprint: evidenceFingerprint,
          },
        },
        score: mean,
        raw_metric: {
          label: "三次运行通过率 mean@3",
          value: `${displayNumber(mean)} 分`,
        },
        detail:
          `Terminal-Bench 2.1 三次独立 Harbor 运行证据声明，数据集 ${DATASET_ID}。` +
          `转换器已核对三次运行的唯一 run ID、一致分母 ${totalTasks}、整数已解决任务数、` +
          `公开 HTTPS 证据地址与三份唯一 SHA-256，并由整数计数确定性计算 mean@3 = ` +
          `${displayNumber(mean)} 分。转换器不会输出 null；提交的数值成绩仍须由评测作者核对 ` +
          `Harbor 原始 run 输出、三次运行的独立性、数据集版本与模型及 harness 身份后认可。` +
          `该结果不代表 Terminal-Bench 官方或 Harbor 维护者的认证或背书。`,
        task_results: [
          {
            task_id: "terminal-bench-2-1-full",
            score: mean,
            raw: JSON.stringify({
              dataset: DATASET_ID,
              environment: manifest.protocol.environment,
              harbor_version: manifest.protocol.harbor_version,
              mean_pass_rate_pct: mean,
              runs: perRun.map((entry) => ({
                artifact_url: entry.run.artifactUrl,
                harbor_run_sha256: entry.run.harborRunSha256,
                pass_rate_pct: entry.percent,
                resolved_tasks: entry.run.resolvedTasks,
                run_id: entry.run.runId,
                total_tasks: entry.run.totalTasks,
              })),
            }),
          },
        ],
        supplementary_views: [
          {
            type: "metric_table",
            title: "三次独立运行明细",
            columns: ["运行", "已解决", "总任务", "通过率"],
            rows: perRun.map((entry) => ({
              cells: [
                entry.run.runId,
                entry.run.resolvedTasks,
                entry.run.totalTasks,
                `${displayNumber(entry.percent)}%`,
              ],
            })),
            note: "辅助展示不参与排序；主分为三次通过率的算术平均 mean@3。",
          },
        ],
        showcases: [
          {
            type: "timeline",
            title: "三次运行通过率（百分制）",
            series: perRun.map((entry) => ({
              t: entry.run.runId,
              v: entry.percent,
            })),
            events: perRun.map((entry) => ({
              t: entry.run.runId,
              label:
                `${entry.run.runId} · ${displayNumber(entry.percent)} · ` +
                `${entry.run.resolvedTasks}/${entry.run.totalTasks} · task success rate`,
            })),
          },
          {
            type: "transcript",
            title: "公开证据索引",
            turns: [
              {
                role: "system",
                content:
                  `${DATASET_ID} · harbor ${manifest.protocol.harbor_version} · ` +
                  `environment ${manifest.protocol.environment} · ` +
                  `三次运行证据总指纹 sha256:${evidenceFingerprint}`,
              },
              ...perRun.map((entry) => ({
                role: entry.run.runId,
                content:
                  `${entry.run.artifactUrl} · resolved ` +
                  `${entry.run.resolvedTasks}/${entry.run.totalTasks} · ` +
                  `harbor_run sha256:${entry.run.harborRunSha256}`,
                status: "author-review-required",
              })),
            ],
          },
        ],
      },
    ],
  };
}

function validateResultEnvelope(result) {
  let evalDefinition;
  try {
    evalDefinition = EvalDefSchema.parse(
      parseYaml(readFileSync(new URL("./eval.yaml", import.meta.url), "utf8")),
    );
  } catch (error) {
    throw new InputError(`eval.yaml 无法通过共享 schema：${error.message}`);
  }
  const envelope = ResultFileSchema.safeParse(result);
  assert(
    envelope.success,
    `结果文件无法通过共享 schema：${envelope.error?.message ?? "未知错误"}`,
  );
  const contextual = validateResultForEval(evalDefinition, envelope.data);
  assert(
    contextual.success,
    `结果文件与 eval.yaml 不一致：${contextual.error?.message ?? "未知错误"}`,
  );
}

function writeResultAtomically(targetPath, result, manifestPath) {
  let targetDirectory;
  try {
    targetDirectory = realpathSync(dirname(targetPath));
  } catch (error) {
    throw new InputError(`输出目录无法读取：${error.message}`);
  }
  const target = resolve(targetDirectory, basename(targetPath));
  assert(target !== manifestPath, "输出文件不能覆盖 submission.json");
  const temporary = resolve(
    targetDirectory,
    `.${basename(target)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    renameSync(temporary, target);
  } catch (error) {
    try {
      unlinkSync(temporary);
    } catch {
      // Nothing to clean up.
    }
    throw error;
  }
  return target;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestDeclaredPath = resolve(args.manifest);
  const value = parseManifest(manifestDeclaredPath);
  exactKeys(
    value,
    ["schema_version", "run_date", "participant", "protocol", "runs"],
    [],
    "submission.json",
  );
  assert(value.schema_version === SCHEMA_VERSION, `schema_version 必须是 ${SCHEMA_VERSION}`);
  const runDate = validateCalendarDate(value.run_date, "run_date");
  const participant = validateParticipant(value.participant);
  const protocol = validateProtocol(value.protocol);
  const runs = validateRuns(value.runs);
  const manifestPath = realpathSync(manifestDeclaredPath);
  const result = buildResult({ participant, protocol, runDate, runs }, args.evalCommit);
  validateResultEnvelope(result);
  const target = writeResultAtomically(resolve(args.out), result, manifestPath);
  console.log(
    `pack-to-result: 已校验 ${runs.length} 次运行；${result.results[0].raw_metric.value} → ${target}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`pack-to-result: ${message}`);
  process.exitCode = 1;
}
