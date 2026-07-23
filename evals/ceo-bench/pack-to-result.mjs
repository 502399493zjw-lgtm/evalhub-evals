#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const EVAL_ID = "ceo-bench";
const RUNNER_VERSION = "ceo-bench/pack-to-result@1.0.0";
const OFFICIAL_REPOSITORY = "https://github.com/zlab-princeton/run-ceobench";
const PINNED_SOURCE_COMMIT = "f5d500688d95256906fd02cc5aa7524f2fe08d5b";
const REQUIRED_RUNS = 3;
const REQUIRED_DAYS = 497;
const REQUIRED_WEEKS = 71;
const REQUIRED_SEED = 42;
const REQUIRED_INITIAL_CASH = 1_000_000;
const REQUIRED_SCENARIO = "default";
const FINAL_CASH_SQL = "SELECT COALESCE(SUM(amount), 0) AS final_cash FROM ledger";
const MANIFEST_MAX_BYTES = 1024 * 1024;
const JSON_EVIDENCE_MAX_BYTES = 4 * 1024 * 1024;
const HISTORY_MAX_BYTES = 64 * 1024 * 1024;
const HISTORY_MAX_LINES = 100_000;
const HISTORY_MAX_LINE_BYTES = 1024 * 1024;
const SESSION_ID_PATTERN = /^[a-f0-9]{12}$/u;
const EVAL_COMMIT_PATTERN = /^[a-f0-9]{7,40}$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const SECRET_KEY_PATTERN =
  /(?:api.?key|access.?key|auth(?:orization)?|bearer|cookie|credential|password|private.?key|secret|session.?token|token)/iu;
const RESERVED_CONFIG_KEYS = new Set([
  "evidence_fingerprint",
  "initial_cash_usd",
  "protocol",
  "protocol_profile",
  "scenario",
  "effective_days",
  "nominal_days",
  "seed",
  "selected_trial",
  "simulator_llm",
  "source_commit",
  "source_repository",
  "total_days",
  "trials",
  "weeks",
]);
const REQUIRED_EVIDENCE_FILES = [
  "source-remote.txt",
  "source-commit.txt",
  "list-sessions.json",
  "status.json",
  "final-cash.json",
  "history.jsonl",
];
const SIMULATOR_LLM_FIELDS = [
  "social_post_llm_provider",
  "social_post_llm_model",
  "enterprise_llm_provider",
  "enterprise_llm_model",
];

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new InputError(message);
  }
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

function finiteNumber(value, label) {
  assert(typeof value === "number" && Number.isFinite(value), `${label} 必须是有限数值`);
  assert(Math.abs(value) <= Number.MAX_SAFE_INTEGER, `${label} 超出安全数值范围`);
  return value;
}

function safeInteger(value, label) {
  assert(Number.isSafeInteger(value), `${label} 必须是安全整数`);
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readRegularFile(filePath, maxBytes, label) {
  let metadata;
  try {
    metadata = lstatSync(filePath);
  } catch (error) {
    throw new InputError(`${label} 无法读取：${error.message}`);
  }
  assert(metadata.isFile(), `${label} 必须是普通文件，不能是目录或符号链接`);
  assert(metadata.size <= maxBytes, `${label} 超过 ${maxBytes} bytes 上限`);
  return readFileSync(filePath);
}

function parseJsonFile(filePath, maxBytes, label) {
  const bytes = readRegularFile(filePath, maxBytes, label);
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new InputError(`${label} 不是合法 JSON：${error.message}`);
  }
  return { bytes, value };
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
      if (token === "--out") {
        parsed.out = value;
      } else {
        parsed.evalCommit = value;
      }
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

function validateDatedModelId(value) {
  const model = nonEmptyString(value, "participant.model", 255);
  assert(
    /^[A-Za-z0-9._/:+-]+$/u.test(model),
    "participant.model 只能包含 ASCII 字母、数字和 ._/:+-",
  );
  assert(
    model.includes("/") && !model.startsWith("/") && !model.endsWith("/"),
    "participant.model 必须包含 provider 命名空间，例如 anthropic/model-name-YYYYMMDD",
  );
  const match =
    /^(.*)(\d{4})-(\d{2})-(\d{2})$/u.exec(model) ??
    /^(.*)(\d{4})(\d{2})(\d{2})$/u.exec(model);
  assert(match !== null && match[1].length > 0, "participant.model 必须以真实 YYYYMMDD 或 YYYY-MM-DD 日期结尾");
  const year = Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  const date = new Date(Date.UTC(year, month - 1, day));
  assert(
    date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day,
    "participant.model 日期必须是真实公历日期",
  );
  return model;
}

function validateConfigValue(value, label, depth = 0) {
  assert(depth <= 8, `${label} 嵌套层级不能超过 8`);
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    if (typeof value === "string") {
      assert(value.length <= 4096, `${label} 字符串最长 4096 个字符`);
      assert(!CONTROL_CHARACTERS.test(value), `${label} 不能包含控制字符`);
    }
    return;
  }
  if (typeof value === "number") {
    finiteNumber(value, label);
    return;
  }
  if (Array.isArray(value)) {
    assert(value.length <= 100, `${label} 数组最多 100 项`);
    value.forEach((item, index) => validateConfigValue(item, `${label}[${index}]`, depth + 1));
    return;
  }
  assert(isRecord(value), `${label} 只能包含 JSON 值`);
  const entries = Object.entries(value);
  assert(entries.length <= 100, `${label} object 最多 100 个字段`);
  for (const [key, item] of entries) {
    nonEmptyString(key, `${label} 字段名`, 128);
    assert(!SECRET_KEY_PATTERN.test(key), `${label}.${key} 疑似凭据字段，拒绝写入公开结果`);
    validateConfigValue(item, `${label}.${key}`, depth + 1);
  }
}

function validateParticipant(value) {
  exactKeys(
    value,
    ["model", "harness", "harness_version", "config"],
    [],
    "participant",
  );
  const model = validateDatedModelId(value.model);
  const harness = nonEmptyString(value.harness, "participant.harness", 255);
  const harnessVersion = nonEmptyString(
    value.harness_version,
    "participant.harness_version",
    255,
  );
  assert(isRecord(value.config), "participant.config 必须是 JSON object");
  validateConfigValue(value.config, "participant.config");
  for (const key of RESERVED_CONFIG_KEYS) {
    assert(
      !Object.prototype.hasOwnProperty.call(value.config, key),
      `participant.config.${key} 由转换器保留，不能自行填写`,
    );
  }
  const provider = nonEmptyString(value.config.provider, "participant.config.provider", 128);
  const reasoningEffort = nonEmptyString(
    value.config.reasoning_effort,
    "participant.config.reasoning_effort",
    128,
  );
  assert(
    model.split("/", 1)[0] === provider,
    "participant.model 的 provider 命名空间必须与 participant.config.provider 一致",
  );
  assert(
    reasoningEffort === "max",
    'participant.config.reasoning_effort 必须填写标准化值 "max"，并由作者核对实际 runner 已启用最高推理强度',
  );
  return {
    model,
    harness,
    harness_version: harnessVersion,
    config: { ...value.config, provider, reasoning_effort: reasoningEffort },
  };
}

function validateHttpsUrl(value, label) {
  const text = nonEmptyString(value, label, 2048);
  let url;
  try {
    url = new URL(text);
  } catch (error) {
    throw new InputError(`${label} 不是合法 URL：${error.message}`);
  }
  assert(url.protocol === "https:", `${label} 必须使用 https`);
  assert(url.username === "" && url.password === "", `${label} 不能内嵌用户名或密码`);
  assert(url.search === "", `${label} 不能包含 query 参数，以免公开链接泄露凭据`);
  assert(url.hash === "", `${label} 不能包含 fragment`);
  return url.toString();
}

function resolveEvidenceDirectory(manifestDirectory, value, label) {
  const evidenceDir = nonEmptyString(value, label, 1024);
  assert(!isAbsolute(evidenceDir), `${label} 必须是相对 submission.json 的路径`);
  const absolute = resolve(manifestDirectory, evidenceDir);
  const pathFromManifest = relative(manifestDirectory, absolute);
  assert(
    pathFromManifest !== "" &&
      pathFromManifest !== ".." &&
      !pathFromManifest.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
      !isAbsolute(pathFromManifest),
    `${label} 不能跳出 submission.json 所在目录`,
  );
  let metadata;
  try {
    metadata = lstatSync(absolute);
  } catch (error) {
    throw new InputError(`${label} 无法读取：${error.message}`);
  }
  assert(metadata.isDirectory(), `${label} 必须是目录，不能是符号链接`);
  const manifestReal = realpathSync(manifestDirectory);
  const evidenceReal = realpathSync(absolute);
  const realRelative = relative(manifestReal, evidenceReal);
  assert(
    realRelative !== "" &&
      realRelative !== ".." &&
      !realRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
      !isAbsolute(realRelative),
    `${label} 解析后不能跳出 submission.json 所在目录`,
  );
  return { declared: evidenceDir, absolute: evidenceReal };
}

function normalizeOfficialRemote(value, label) {
  const remote = nonEmptyString(value.trim(), label, 512);
  const accepted = new Set([
    OFFICIAL_REPOSITORY,
    `${OFFICIAL_REPOSITORY}.git`,
    "git@github.com:zlab-princeton/run-ceobench.git",
    "ssh://git@github.com/zlab-princeton/run-ceobench.git",
  ]);
  assert(
    accepted.has(remote),
    `${label} 必须指向官方仓库 ${OFFICIAL_REPOSITORY}`,
  );
  return OFFICIAL_REPOSITORY;
}

function validateSimulatorLlm(value, label) {
  exactKeys(value, SIMULATOR_LLM_FIELDS, [], label);
  const output = {};
  for (const field of SIMULATOR_LLM_FIELDS) {
    output[field] = nonEmptyString(value[field], `${label}.${field}`, 255);
  }
  return output;
}

function validateHistory(bytes, currentDay, label) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InputError(`${label} 不是合法 UTF-8`);
  }
  assert(!text.includes("\r"), `${label} 必须是规范化 LF JSONL`);
  assert(text.endsWith("\n"), `${label} 必须以单个换行结束`);
  const lines = text.split("\n");
  lines.pop();
  assert(lines.length > 0 && lines.every((line) => line.length > 0), `${label} 不能包含空行`);
  assert(lines.length <= HISTORY_MAX_LINES, `${label} 最多 ${HISTORY_MAX_LINES} 行`);

  const expectedDays = [];
  for (let day = 7; day <= currentDay; day += 7) {
    expectedDays.push(day);
  }
  if (currentDay % 7 !== 0) {
    expectedDays.push(currentDay);
  }
  assert(
    lines.length === expectedDays.length + 1,
    `${label} 必须包含完整的每周推进边界和唯一终局查询`,
  );

  for (const [index, line] of lines.entries()) {
    assert(Buffer.byteLength(line) <= HISTORY_MAX_LINE_BYTES, `${label} 第 ${index + 1} 行过长`);
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      throw new InputError(`${label} 第 ${index + 1} 行不是合法 JSON`);
    }
    assert(isRecord(record), `${label} 第 ${index + 1} 行必须是 JSON object`);

    if (index < expectedDays.length) {
      assert(
        Object.keys(record).length === 2 &&
          record.type === "next_week" &&
          record.day === expectedDays[index],
        `${label} 第 ${index + 1} 行不是规范化的脱敏推进记录`,
      );
      continue;
    }

    assert(
      Object.keys(record).length === 4 &&
        record.type === "query" &&
        record.sql === FINAL_CASH_SQL &&
        record.row_count === 1 &&
        record.success === true,
      `${label} 最后一行必须是唯一、规范化的脱敏 final_cash 查询`,
    );
  }
  return { lineCount: lines.length, advancedDayCount: expectedDays.length };
}

function validateRun(run, index, manifestDirectory) {
  const label = `runs[${index}]`;
  exactKeys(run, ["evidence_dir", "artifact_url"], [], label);
  const evidence = resolveEvidenceDirectory(
    manifestDirectory,
    run.evidence_dir,
    `${label}.evidence_dir`,
  );
  const artifactUrl = validateHttpsUrl(run.artifact_url, `${label}.artifact_url`);
  const directoryEntries = readdirSync(evidence.absolute, { withFileTypes: true });
  assert(
    directoryEntries.length === REQUIRED_EVIDENCE_FILES.length &&
      directoryEntries.every(
        (entry) => entry.isFile() && REQUIRED_EVIDENCE_FILES.includes(entry.name),
      ),
    `${label}.evidence_dir 只能包含规定的 ${REQUIRED_EVIDENCE_FILES.length} 个普通证据文件`,
  );
  const fileBytes = new Map();
  for (const name of REQUIRED_EVIDENCE_FILES) {
    const limit = name === "history.jsonl" ? HISTORY_MAX_BYTES : JSON_EVIDENCE_MAX_BYTES;
    const bytes = readRegularFile(resolve(evidence.absolute, name), limit, `${label}/${name}`);
    fileBytes.set(name, bytes);
  }

  const remote = normalizeOfficialRemote(
    fileBytes.get("source-remote.txt").toString("utf8").trim(),
    `${label}/source-remote.txt`,
  );
  const sourceCommit = nonEmptyString(
    fileBytes.get("source-commit.txt").toString("utf8").trim(),
    `${label}/source-commit.txt`,
    40,
  );
  assert(
    sourceCommit === PINNED_SOURCE_COMMIT,
    `${label}/source-commit.txt 必须是钉死版本 ${PINNED_SOURCE_COMMIT}`,
  );

  let sessions;
  let status;
  let finalCashResult;
  try {
    sessions = JSON.parse(fileBytes.get("list-sessions.json").toString("utf8"));
  } catch (error) {
    throw new InputError(`${label}/list-sessions.json 不是合法 JSON：${error.message}`);
  }
  try {
    status = JSON.parse(fileBytes.get("status.json").toString("utf8"));
  } catch (error) {
    throw new InputError(`${label}/status.json 不是合法 JSON：${error.message}`);
  }
  try {
    finalCashResult = JSON.parse(fileBytes.get("final-cash.json").toString("utf8"));
  } catch (error) {
    throw new InputError(`${label}/final-cash.json 不是合法 JSON：${error.message}`);
  }

  exactKeys(sessions, ["sessions", "count"], [], `${label}/list-sessions.json`);
  assert(Array.isArray(sessions.sessions), `${label}/list-sessions.json.sessions 必须是数组`);
  assert(
    safeInteger(sessions.count, `${label}/list-sessions.json.count`) === 1,
    `${label}/list-sessions.json.count 必须是 1`,
  );
  assert(
    sessions.sessions.length === 1,
    `${label} 必须来自只有一个 session 的独立工作副本`,
  );
  const listed = sessions.sessions[0];
  exactKeys(
    listed,
    ["session_id", "created_at", "current_day", "total_days", "status"],
    [],
    `${label}/list-sessions.json.sessions[0]`,
  );

  assert(isRecord(status), `${label}/status.json 必须是 JSON object`);
  const sessionId = nonEmptyString(status.session_id, `${label}/status.json.session_id`, 64);
  assert(SESSION_ID_PATTERN.test(sessionId), `${label} session_id 必须是 12 位小写十六进制`);
  assert(listed.session_id === sessionId, `${label} list-sessions 与 status 的 session_id 不一致`);
  const currentDay = safeInteger(status.current_day, `${label}/status.json.current_day`);
  assert(currentDay >= 1 && currentDay <= REQUIRED_DAYS, `${label} current_day 必须在 1-${REQUIRED_DAYS}`);
  assert(listed.current_day === currentDay, `${label} list-sessions 与 status 的 current_day 不一致`);
  assert(status.total_days === REQUIRED_DAYS, `${label} total_days 必须是 ${REQUIRED_DAYS}`);
  assert(listed.total_days === REQUIRED_DAYS, `${label} list-sessions.total_days 必须是 ${REQUIRED_DAYS}`);
  assert(status.seed === REQUIRED_SEED, `${label} seed 必须是 ${REQUIRED_SEED}`);
  assert(
    finiteNumber(status.initial_cash, `${label}/status.json.initial_cash`) ===
      REQUIRED_INITIAL_CASH,
    `${label} initial_cash 必须是 ${REQUIRED_INITIAL_CASH}`,
  );
  assert(status.scenario === REQUIRED_SCENARIO, `${label} scenario 必须是 ${REQUIRED_SCENARIO}`);
  finiteNumber(status.created_at, `${label}/status.json.created_at`);
  assert(
    listed.created_at === status.created_at,
    `${label} list-sessions 与 status 的 created_at 不一致`,
  );
  const createdAt = new Date(status.created_at * 1000);
  assert(!Number.isNaN(createdAt.getTime()), `${label} created_at 不是有效时间戳`);
  const simulatorLlm = validateSimulatorLlm(
    status.simulator_llm,
    `${label}/status.json.simulator_llm`,
  );

  exactKeys(
    finalCashResult,
    ["columns", "rows", "row_count"],
    [],
    `${label}/final-cash.json`,
  );
  assert(
    Array.isArray(finalCashResult.columns) &&
      finalCashResult.columns.length === 1 &&
      finalCashResult.columns[0] === "final_cash",
    `${label}/final-cash.json.columns 必须精确为 ["final_cash"]`,
  );
  assert(
    Array.isArray(finalCashResult.rows) && finalCashResult.rows.length === 1,
    `${label}/final-cash.json.rows 必须恰有一行`,
  );
  exactKeys(
    finalCashResult.rows[0],
    ["final_cash"],
    [],
    `${label}/final-cash.json.rows[0]`,
  );
  assert(finalCashResult.row_count === 1, `${label}/final-cash.json.row_count 必须是 1`);
  const finalCash = finiteNumber(
    finalCashResult.rows[0].final_cash,
    `${label}/final-cash.json.rows[0].final_cash`,
  );

  const outcome =
    finalCash < 0 ? "bankrupt" : currentDay === REQUIRED_DAYS ? "completed" : "incomplete";
  assert(
    outcome !== "incomplete",
    `${label} 只运行到第 ${currentDay} 天且现金未破产，属于未完成运行；EvalHub 固定整周复现配置必须完成 497 天`,
  );
  const history = validateHistory(
    fileBytes.get("history.jsonl"),
    currentDay,
    `${label}/history.jsonl`,
  );
  const hashes = Object.fromEntries(
    REQUIRED_EVIDENCE_FILES.map((name) => [name, sha256(fileBytes.get(name))]),
  );
  const evidenceFingerprint = sha256(
    Buffer.from(JSON.stringify({ sessionId, sourceCommit, hashes }), "utf8"),
  );

  return {
    artifactUrl,
    createdAt,
    currentDay,
    evidenceAbsolute: evidence.absolute,
    evidenceDir: evidence.declared,
    evidenceFingerprint,
    finalCash,
    hashes,
    history,
    outcome,
    remote,
    sessionId,
    simulatorLlm,
    sourceCommit,
  };
}

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function selectRepresentative(runs) {
  const completed = runs.filter((run) => run.outcome === "completed");
  if (completed.length > 0) {
    return {
      proposedScore: Math.max(...completed.map((run) => run.finalCash)),
      representative: [...completed].sort(
        (left, right) =>
          right.finalCash - left.finalCash || left.sessionId.localeCompare(right.sessionId),
      )[0],
    };
  }
  const representative = [...runs].sort(
    (left, right) =>
      right.currentDay - left.currentDay ||
      right.finalCash - left.finalCash ||
      left.sessionId.localeCompare(right.sessionId),
  )[0];
  return { proposedScore: 0, representative };
}

function buildResult(manifest, runs, evalCommit) {
  const simulatorConfiguration = JSON.stringify(runs[0].simulatorLlm);
  for (const [index, run] of runs.entries()) {
    assert(
      JSON.stringify(run.simulatorLlm) === simulatorConfiguration,
      `runs[${index}] 的 simulator_llm 与其他 trial 不一致`,
    );
  }
  const sessionIds = new Set(runs.map((run) => run.sessionId));
  assert(sessionIds.size === REQUIRED_RUNS, "3 次运行必须使用不同 session_id");
  const artifactUrls = new Set(runs.map((run) => run.artifactUrl));
  assert(artifactUrls.size === REQUIRED_RUNS, "3 次运行必须提供不同 artifact_url");
  const evidenceDirs = new Set(runs.map((run) => run.evidenceAbsolute));
  assert(evidenceDirs.size === REQUIRED_RUNS, "3 次运行必须使用不同 evidence_dir");

  const { proposedScore, representative } = selectRepresentative(runs);
  const completedCount = runs.filter((run) => run.outcome === "completed").length;
  const bankruptCount = runs.length - completedCount;
  const evidenceFingerprint = sha256(
    Buffer.from(
      JSON.stringify(
        [...runs]
          .sort((left, right) => left.sessionId.localeCompare(right.sessionId))
          .map((run) => ({
            artifact_url: run.artifactUrl,
            evidence_fingerprint: run.evidenceFingerprint,
            session_id: run.sessionId,
          })),
      ),
      "utf8",
    ),
  );
  const latestRunDate = new Date(
    Math.max(...runs.map((run) => run.createdAt.getTime())),
  )
    .toISOString()
    .slice(0, 10);
  const statusLabel =
    representative.outcome === "completed" ? "完整结束" : "破产结束";
  const scoreExplanation =
    completedCount > 0
      ? `存在完整运行，按公开规则建议作者回填最高完整终局现金 ${formatUsd(proposedScore)}。`
      : `3 次运行均破产，按公开规则建议作者回填 0 USD；代表运行按最长存活天数选取。`;

  const result = {
    eval_id: EVAL_ID,
    ...(evalCommit === null ? {} : { eval_commit: evalCommit }),
    submission: {
      runner_version: RUNNER_VERSION,
      run_date: latestRunDate,
    },
    results: [
      {
        participant: {
          model: manifest.participant.model,
          harness: manifest.participant.harness,
          harness_version: manifest.participant.harness_version,
          config: {
            ...manifest.participant.config,
            protocol_profile: "evalhub-fixed-weekly-v1",
            source_repository: OFFICIAL_REPOSITORY,
            source_commit: PINNED_SOURCE_COMMIT,
            seed: REQUIRED_SEED,
            initial_cash_usd: REQUIRED_INITIAL_CASH,
            scenario: REQUIRED_SCENARIO,
            trials: REQUIRED_RUNS,
            simulator_llm: runs[0].simulatorLlm,
            selected_trial: representative.sessionId,
            evidence_fingerprint: evidenceFingerprint,
          },
        },
        score: null,
        raw_metric: {
          label: "3 次运行 · 作者待复核",
          value:
            `代表运行 ${representative.sessionId}：${statusLabel}，终局现金 ` +
            `${formatUsd(representative.finalCash)}；${completedCount} 次完成 / ${bankruptCount} 次破产`,
          tiebreak_value: representative.currentDay,
        },
        detail:
          `第三方 CEO-Bench 证据包，钉死官方运行仓库 commit ${PINNED_SOURCE_COMMIT}。` +
          `已本地校验 3 个独立 session：seed 42、初始现金 1,000,000 USD、default 场景、` +
          `相同 simulator_llm 配置、完整的 EvalHub 固定整周复现配置、` +
          `严格白名单脱敏的逐周 history 和唯一 final_cash 查询输出。` +
          `${scoreExplanation}提交侧 score 保持 null，只有评测集作者核对公开 artifact 与本地 SHA-256 后才能判分和认可。` +
          `此集成不是 Princeton 官方榜单、官方认证或作者背书。`,
        showcases: [
          {
            type: "timeline",
            title: "三次独立运行结果",
            series: runs.map((run, index) => ({
              t: `Trial ${index + 1}`,
              v: run.finalCash,
            })),
            events: runs.map((run, index) => ({
              t: `Trial ${index + 1}`,
                label:
                `${run.sessionId} · ${run.outcome === "completed" ? "完整结束" : "破产结束"}` +
                ` · ${formatUsd(run.finalCash)}`,
            })),
          },
          {
            type: "transcript",
            title: "公开证据索引（合规输出，不读取 world.nmdb 或 novamind-operation）",
            turns: [
              {
                role: "system",
                content:
                  `源仓库 ${OFFICIAL_REPOSITORY}@${PINNED_SOURCE_COMMIT}；` +
                  `三次证据总指纹 sha256:${evidenceFingerprint}`,
              },
              ...runs.map((run, index) => ({
                role: `trial-${index + 1}`,
                content:
                  `${run.artifactUrl} · session ${run.sessionId} · evidence sha256:` +
                  `${run.evidenceFingerprint} · history ${run.history.lineCount} 行`,
                status: run.outcome,
              })),
            ],
          },
        ],
      },
    ],
  };
  return result;
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = resolve(args.manifest);
  const { value: manifestValue } = parseJsonFile(
    manifestPath,
    MANIFEST_MAX_BYTES,
    "submission.json",
  );
  exactKeys(manifestValue, ["participant", "runs"], [], "submission.json");
  const participant = validateParticipant(manifestValue.participant);
  assert(Array.isArray(manifestValue.runs), "submission.json.runs 必须是数组");
  assert(
    manifestValue.runs.length === REQUIRED_RUNS,
    `submission.json.runs 必须恰好包含 ${REQUIRED_RUNS} 次运行`,
  );
  const manifestRealPath = realpathSync(manifestPath);
  const manifestDirectory = dirname(manifestRealPath);
  const runs = manifestValue.runs.map((run, index) =>
    validateRun(run, index, manifestDirectory),
  );
  const declaredTarget = resolve(args.out);
  let targetDirectory;
  try {
    targetDirectory = realpathSync(dirname(declaredTarget));
  } catch (error) {
    throw new InputError(`输出目录无法读取：${error.message}`);
  }
  const target = resolve(targetDirectory, basename(declaredTarget));
  assert(target !== manifestRealPath, "输出文件不能覆盖 submission.json");
  for (const [index, run] of runs.entries()) {
    const fromEvidence = relative(run.evidenceAbsolute, target);
    assert(
      fromEvidence === ".." ||
        fromEvidence.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`),
      `输出文件不能位于 runs[${index}].evidence_dir 内`,
    );
  }
  const result = buildResult({ participant }, runs, args.evalCommit);
  validateResultEnvelope(result);
  const temporary = resolve(
    dirname(target),
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
  const representative = result.results[0];
  console.log(
    `pack-to-result: 已校验 3 次运行；${representative.raw_metric.value} → ${target}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`pack-to-result: ${message}`);
  process.exitCode = 1;
}
