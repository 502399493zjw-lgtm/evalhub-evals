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

const EVAL_ID = "rsibench-data";
const RUNNER_VERSION = "rsibench-data/pack-to-result@1.1.0";
const SCHEMA_VERSION = "1.1";
const SOURCE_REPOSITORY = "https://github.com/evolvent-ai/RSIBench-Data";
const SOURCE_COMMIT = "39948a17925272367b64dd53427a4dba3f572f4e";
const TARGET_MODEL = "Qwen/Qwen3.5-35B-A3B-Base";
const ROLLOUT_MODEL = "claude-opus-4-8";
const WALL_TIME_BUDGET_SEC = 57_600;
const TINKER_COST_BUDGET_USD = 500;
const N_CONCURRENT = 32;
const STEP_LIMIT = 200;
const MANIFEST_MAX_BYTES = 1024 * 1024;
const EVAL_COMMIT_PATTERN = /^[a-f0-9]{7,40}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._/:+-]+$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]{3,128}$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

const PROFILE_SPECS = Object.freeze([
  Object.freeze({
    taskId: "swe-bench-verified",
    name: "SWE-bench Verified",
    benchmarkId: "swe-bench-verified@1.0",
    harborDataset: "benchmarks/swe_bench_verified/datasets/seed23_random_100",
    harborAgent: "mini-swe-agent",
    harborAgentConfigProfile: "mini_swe_agent",
    nTasks: 100,
    nAttempts: 1,
    metric: "resolved rate",
  }),
  Object.freeze({
    taskId: "swe-bench-multilingual",
    name: "SWE-bench Multilingual",
    benchmarkId: "swe-bench-multilingual@1.0",
    harborDataset: "benchmarks/swe_bench_multilingual/datasets/seed23_random_100",
    harborAgent: "mini-swe-agent",
    harborAgentConfigProfile: "mini_swe_agent",
    nTasks: 100,
    nAttempts: 1,
    metric: "resolved rate",
  }),
  Object.freeze({
    taskId: "swe-bench-pro",
    name: "SWE-bench Pro",
    benchmarkId: "swe-bench-pro@1.0",
    harborDataset: "benchmarks/swe_bench_pro/datasets/seed23_random_100",
    harborAgent: "mini-swe-agent",
    harborAgentConfigProfile: "mini_swe_agent",
    nTasks: 100,
    nAttempts: 1,
    metric: "resolved rate",
  }),
  Object.freeze({
    taskId: "terminal-bench-2",
    name: "Terminal-Bench 2.0",
    benchmarkId: "terminal-bench-2@2.0",
    harborDataset: "terminal-bench/terminal-bench-2",
    harborAgent: "terminus-2",
    harborAgentConfigProfile: "terminus_2",
    nTasks: 89,
    nAttempts: 1,
    metric: "task success rate",
  }),
  Object.freeze({
    taskId: "gpqa-diamond",
    name: "GPQA Diamond",
    benchmarkId: "gpqa-diamond@1.0",
    harborDataset: "benchmarks/gpqa_diamond/datasets/seed23_random_100",
    harborAgent: "terminus-2",
    harborAgentConfigProfile: "terminus_2",
    nTasks: 100,
    nAttempts: 1,
    metric: "accuracy",
  }),
  Object.freeze({
    taskId: "aime",
    name: "AIME 2026",
    benchmarkId: "aime@1.0",
    harborDataset: "benchmarks/aime/datasets/full_30_2026",
    harborAgent: "terminus-2",
    harborAgentConfigProfile: "terminus_2",
    nTasks: 30,
    nAttempts: 4,
    metric: "avg@4 accuracy",
  }),
]);

const PROFILE_BY_ID = new Map(PROFILE_SPECS.map((profile) => [profile.taskId, profile]));

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

function validateDatedModelId(value) {
  const model = validateSafeId(value, "participant.model");
  assert(
    model.includes("/") && !model.startsWith("/") && !model.endsWith("/"),
    "participant.model 必须包含 provider 命名空间",
  );
  const match = /^(.*?)(\d{4})(\d{2})(\d{2})$/u.exec(model);
  assert(match !== null && match[1].length > 0, "participant.model 必须以 YYYYMMDD 版本日期结尾");
  const year = Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  const date = new Date(Date.UTC(year, month - 1, day));
  assert(
    date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day,
    "participant.model 末尾必须是真实公历日期",
  );
  return model;
}

function validateParticipant(value) {
  exactKeys(value, ["model", "harness", "harness_version", "config"], [], "participant");
  exactKeys(value.config, ["provider", "reasoning_effort"], [], "participant.config");
  const model = validateDatedModelId(value.model);
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
    [
      "source_repository",
      "source_commit",
      "target_model",
      "rollout_model",
      "wall_time_budget_sec",
      "tinker_cost_budget_usd",
    ],
    [],
    "protocol",
  );
  assert(
    value.source_repository === SOURCE_REPOSITORY,
    `protocol.source_repository 必须是 ${SOURCE_REPOSITORY}`,
  );
  assert(
    value.source_commit === SOURCE_COMMIT,
    `protocol.source_commit 必须是 ${SOURCE_COMMIT}`,
  );
  assert(value.target_model === TARGET_MODEL, `protocol.target_model 必须是 ${TARGET_MODEL}`);
  assert(
    value.rollout_model === ROLLOUT_MODEL,
    `protocol.rollout_model 必须是 ${ROLLOUT_MODEL}`,
  );
  assert(
    value.wall_time_budget_sec === WALL_TIME_BUDGET_SEC,
    `protocol.wall_time_budget_sec 必须是 ${WALL_TIME_BUDGET_SEC}`,
  );
  assert(
    value.tinker_cost_budget_usd === TINKER_COST_BUDGET_USD,
    `protocol.tinker_cost_budget_usd 必须是 ${TINKER_COST_BUDGET_USD}`,
  );
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
      "task_id",
      "run_id",
      "successful_trials",
      "artifact_url",
      "official_eval_sha256",
      "harbor_result_sha256",
      "integrity_audit_sha256",
    ],
    [],
    label,
  );
  const taskId = nonEmptyString(value.task_id, `${label}.task_id`, 128);
  const profile = PROFILE_BY_ID.get(taskId);
  assert(profile !== undefined, `${label}.task_id 不是固定的六个 profile 之一`);
  const runId = nonEmptyString(value.run_id, `${label}.run_id`, 128);
  assert(RUN_ID_PATTERN.test(runId), `${label}.run_id 只能包含字母、数字和 ._-`);
  const totalTrials = profile.nTasks * profile.nAttempts;
  assert(
    Number.isSafeInteger(value.successful_trials) &&
      value.successful_trials >= 0 &&
      value.successful_trials <= totalTrials,
    `${label}.successful_trials 必须是 0 至 ${totalTrials} 的安全整数`,
  );
  return {
    artifactUrl: validateHttpsArtifactUrl(value.artifact_url, `${label}.artifact_url`),
    harborResultSha256: validateSha256(
      value.harbor_result_sha256,
      `${label}.harbor_result_sha256`,
    ),
    integrityAuditSha256: validateSha256(
      value.integrity_audit_sha256,
      `${label}.integrity_audit_sha256`,
    ),
    officialEvalSha256: validateSha256(
      value.official_eval_sha256,
      `${label}.official_eval_sha256`,
    ),
    profile,
    runId,
    successfulTrials: value.successful_trials,
    taskId,
  };
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
  assert(metadata.size <= MANIFEST_MAX_BYTES, `submission.json 超过 ${MANIFEST_MAX_BYTES} bytes`);
  let value;
  try {
    value = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new InputError(`submission.json 不是合法 JSON：${error.message}`);
  }
  return value;
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

function validateRuns(value) {
  assert(Array.isArray(value), "runs 必须是数组");
  assert(value.length === PROFILE_SPECS.length, `runs 必须恰好包含 ${PROFILE_SPECS.length} 项`);
  const runs = value.map((run, index) => validateRun(run, index));
  const taskIds = new Set(runs.map((run) => run.taskId));
  assert(taskIds.size === PROFILE_SPECS.length, "六个 task_id 必须各出现一次，不能重复");
  for (const profile of PROFILE_SPECS) {
    assert(taskIds.has(profile.taskId), `runs 缺少 ${profile.taskId}`);
  }
  const runIds = new Set(runs.map((run) => run.runId));
  assert(runIds.size === runs.length, "六个 profile 必须使用不同 run_id");
  const artifactUrls = new Set(runs.map((run) => run.artifactUrl));
  assert(artifactUrls.size === runs.length, "六个 profile 必须使用不同 artifact_url");
  const allHashes = runs.flatMap((run) => [
    run.officialEvalSha256,
    run.harborResultSha256,
    run.integrityAuditSha256,
  ]);
  assert(new Set(allHashes).size === allHashes.length, "18 个证据文件必须使用不同 SHA-256");
  const byId = new Map(runs.map((run) => [run.taskId, run]));
  return PROFILE_SPECS.map((profile) => byId.get(profile.taskId));
}

function buildResult(manifest, evalCommit) {
  const taskResults = manifest.runs.map((run) => {
    const totalTrials = run.profile.nTasks * run.profile.nAttempts;
    const upstreamHarborScore = run.successfulTrials / totalTrials;
    const percentScore = roundSix(upstreamHarborScore * 100);
    return {
      task_id: run.taskId,
      score: percentScore,
      raw: JSON.stringify({
        artifact_url: run.artifactUrl,
        evidence: {
          harbor_result_sha256: run.harborResultSha256,
          integrity_audit_sha256: run.integrityAuditSha256,
          official_eval_sha256: run.officialEvalSha256,
        },
        metric: run.profile.metric,
        profile: {
          benchmark_id: run.profile.benchmarkId,
          harbor_agent: run.profile.harborAgent,
          harbor_agent_config_profile: run.profile.harborAgentConfigProfile,
          harbor_dataset: run.profile.harborDataset,
          n_attempts: run.profile.nAttempts,
          n_concurrent: N_CONCURRENT,
          n_tasks: run.profile.nTasks,
          step_limit: STEP_LIMIT,
          total_trials: totalTrials,
        },
        run_id: run.runId,
        successful_trials: run.successfulTrials,
        upstream_harbor_score: upstreamHarborScore,
      }),
    };
  });
  const proposedMacroAverage = roundSix(
    taskResults.reduce((sum, task) => sum + task.score, 0) / taskResults.length,
  );
  const evidenceFingerprint = sha256Text(
    JSON.stringify({
      source_commit: SOURCE_COMMIT,
      runs: manifest.runs.map((run) => ({
        artifact_url: run.artifactUrl,
        harbor_result_sha256: run.harborResultSha256,
        integrity_audit_sha256: run.integrityAuditSha256,
        official_eval_sha256: run.officialEvalSha256,
        run_id: run.runId,
        successful_trials: run.successfulTrials,
        task_id: run.taskId,
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
            protocol_profile: "rsibench-data-paper-main-v1",
            source_repository: SOURCE_REPOSITORY,
            source_commit: SOURCE_COMMIT,
            target_model: TARGET_MODEL,
            rollout_model: ROLLOUT_MODEL,
            profiles: PROFILE_SPECS.length,
            wall_time_budget_sec_per_profile: WALL_TIME_BUDGET_SEC,
            tinker_cost_budget_usd_per_profile: TINKER_COST_BUDGET_USD,
            evidence_fingerprint: evidenceFingerprint,
          },
        },
        score: null,
        raw_metric: {
          label: "六项等权宏平均 · 作者待复核",
          value: `${displayNumber(proposedMacroAverage)} 分（声明值）`,
        },
        detail:
          `第三方 RSIBench-Data 六项证据声明，固定来源 commit ${SOURCE_COMMIT}。` +
          `转换器已核对六个唯一 profile、独立 run ID、固定主协议、整数成功次数、` +
          `公开 HTTPS 证据地址和 18 个唯一 SHA-256；声明的 EvalHub 派生宏平均为 ` +
          `${displayNumber(proposedMacroAverage)} 分。score 保持 null，只有评测作者核对原始 Harbor ` +
          `结果、预算、检查点选择顺序、完整性审计、数据隔离与研究者身份后才能回填并认可。` +
          `该宏平均不是上游官方指标，本接入也不是 Evolvent AI 的认证或背书。`,
        task_results: taskResults,
        showcases: [
          {
            type: "timeline",
            title: "六个上游原生分项（百分制声明值，待作者复核）",
            series: taskResults.map((task) => ({ t: task.task_id, v: task.score })),
            events: manifest.runs.map((run, index) => ({
              t: run.taskId,
              label:
                `${run.profile.name} · ${displayNumber(taskResults[index].score)} · ` +
                `${run.successfulTrials}/${run.profile.nTasks * run.profile.nAttempts} · ` +
                `${run.profile.metric}`,
            })),
          },
          {
            type: "transcript",
            title: "公开证据索引",
            turns: [
              {
                role: "system",
                content:
                  `${SOURCE_REPOSITORY}@${SOURCE_COMMIT} · ` +
                  `六项证据总指纹 sha256:${evidenceFingerprint}`,
              },
              ...manifest.runs.map((run) => ({
                role: run.taskId,
                content:
                  `${run.artifactUrl} · run ${run.runId} · successes ` +
                  `${run.successfulTrials}/${run.profile.nTasks * run.profile.nAttempts} · ` +
                  `official_eval sha256:` +
                  `${run.officialEvalSha256} · harbor_result sha256:${run.harborResultSha256} · ` +
                  `integrity_audit sha256:${run.integrityAuditSha256}`,
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
  validateProtocol(value.protocol);
  const runs = validateRuns(value.runs);
  const manifestPath = realpathSync(manifestDeclaredPath);
  const result = buildResult({ participant, runDate, runs }, args.evalCommit);
  validateResultEnvelope(result);
  const target = writeResultAtomically(resolve(args.out), result, manifestPath);
  console.log(
    `pack-to-result: 已校验 ${runs.length} 个 profile；${result.results[0].raw_metric.value} → ${target}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`pack-to-result: ${message}`);
  process.exitCode = 1;
}
