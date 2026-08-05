import {
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const EVAL_ID = "terminal-bench-harbor";
const IMPORTER_VERSION = "terminal-bench-harbor/official-result-to-envelope@1.0.0";
const SNAPSHOT_URL = new URL(
  "./tasks/terminal-bench-official-results-2026-08-05.json",
  import.meta.url,
);
const EVAL_COMMIT_PATTERN = /^[a-f0-9]{7,40}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const EXPECTED_ENTRIES = 17;

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

function assert(condition, message) {
  if (!condition) throw new InputError(message);
}

function roundSix(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function parseArgs(argv) {
  const parsed = { participant: null, out: null, evalCommit: null };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    assert(
      ["--participant", "--out", "--eval-commit"].includes(token),
      `未知参数 ${token}`,
    );
    assert(!seen.has(token), `参数 ${token} 不能重复`);
    seen.add(token);
    const value = argv[index + 1];
    assert(value !== undefined && !value.startsWith("--"), `参数 ${token} 缺少值`);
    if (token === "--participant") parsed.participant = value;
    else if (token === "--out") parsed.out = value;
    else parsed.evalCommit = value;
    index += 1;
  }
  assert(parsed.participant !== null, "缺少 --participant");
  assert(parsed.out !== null, "缺少 --out");
  if (parsed.evalCommit !== null) {
    assert(
      EVAL_COMMIT_PATTERN.test(parsed.evalCommit),
      "--eval-commit 必须是 7-40 位小写十六进制 Git commit",
    );
  }
  return parsed;
}

function loadSnapshot() {
  const filePath = fileURLToPath(SNAPSHOT_URL);
  let metadata;
  try {
    metadata = lstatSync(filePath);
  } catch (error) {
    throw new InputError(`快照无法读取：${error.message}`);
  }
  assert(metadata.isFile(), "快照必须是普通文件");
  let snapshot;
  try {
    snapshot = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new InputError(`快照不是合法 JSON：${error.message}`);
  }
  assert(typeof snapshot.retrieved_on === "string", "快照缺少 retrieved_on");
  assert(
    snapshot.source !== null &&
      typeof snapshot.source === "object" &&
      typeof snapshot.source.title === "string" &&
      typeof snapshot.source.url === "string" &&
      SHA256_PATTERN.test(snapshot.source.snapshot_sha256),
    "快照 source 必须包含 title、url 和 64 位小写 snapshot_sha256",
  );
  assert(Array.isArray(snapshot.entries), "快照 entries 必须是数组");
  assert(
    snapshot.entries.length === EXPECTED_ENTRIES,
    `快照必须恰好包含 ${EXPECTED_ENTRIES} 条官网成绩`,
  );
  const ids = new Set(snapshot.entries.map((entry) => entry.participant_id));
  assert(ids.size === snapshot.entries.length, "快照 participant_id 必须唯一");
  for (const entry of snapshot.entries) {
    assert(
      typeof entry.participant_id === "string" && entry.participant_id.length > 0,
      "快照 participant_id 必须是非空字符串",
    );
    assert(
      typeof entry.harness === "string" && entry.harness.trim() === entry.harness,
      `${entry.participant_id} 的 harness 非法`,
    );
    assert(
      typeof entry.model === "string" && entry.model.trim() === entry.model,
      `${entry.participant_id} 的 model 非法`,
    );
    assert(
      typeof entry.accuracy_pct === "number" &&
        Number.isFinite(entry.accuracy_pct) &&
        entry.accuracy_pct >= 0 &&
        entry.accuracy_pct <= 100,
      `${entry.participant_id} 的 accuracy_pct 必须是 0 至 100 的数值`,
    );
    assert(
      typeof entry.accuracy_stderr_pct === "number" &&
        Number.isFinite(entry.accuracy_stderr_pct) &&
        entry.accuracy_stderr_pct >= 0 &&
        entry.accuracy_stderr_pct <= 100,
      `${entry.participant_id} 的 accuracy_stderr_pct 必须是 0 至 100 的数值`,
    );
    assert(
      Number.isSafeInteger(entry.n_trials) && entry.n_trials >= 1,
      `${entry.participant_id} 的 n_trials 必须是正整数`,
    );
    for (const key of ["pass_at_2", "pass_at_3", "pass_at_4", "pass_at_5"]) {
      const value = entry[key];
      assert(
        typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1,
        `${entry.participant_id} 的 ${key} 必须是 0 至 1 的数值`,
      );
    }
    assert(
      Number.isSafeInteger(entry.rank) && entry.rank >= 1,
      `${entry.participant_id} 的 rank 必须是正整数`,
    );
    assert(
      typeof entry.published_on === "string" &&
        /^\d{4}-\d{2}-\d{2}$/u.test(entry.published_on),
      `${entry.participant_id} 的 published_on 必须是 YYYY-MM-DD`,
    );
  }
  return snapshot;
}

function buildEnvelope(snapshot, entry, evalCommit) {
  const score = roundSix(entry.accuracy_pct);
  return {
    eval_id: EVAL_ID,
    ...(evalCommit === null ? {} : { eval_commit: evalCommit }),
    submission: {
      kind: "upstream_author_publication",
      importer_version: IMPORTER_VERSION,
      retrieved_on: snapshot.retrieved_on,
      source: {
        title: snapshot.source.title,
        url: snapshot.source.url,
        snapshot_sha256: snapshot.source.snapshot_sha256,
      },
    },
    results: [
      {
        participant: {
          model: entry.model,
          harness: entry.harness,
        },
        score,
        raw_metric: {
          label: "Terminal-Bench 官网公开 accuracy",
          value: `${entry.accuracy_pct}% ± ${entry.accuracy_stderr_pct}%`,
        },
        supplementary_views: [
          {
            type: "metric_table",
            title: "官网榜单公开字段",
            columns: [
              "官网名次",
              "harness",
              "模型",
              "accuracy",
              "标准误",
              "尝试次数",
              "pass@5",
              "官网日期",
            ],
            rows: [
              {
                cells: [
                  entry.rank,
                  entry.harness,
                  entry.model,
                  `${entry.accuracy_pct}%`,
                  `± ${entry.accuracy_stderr_pct}%`,
                  entry.n_trials,
                  entry.pass_at_5,
                  entry.published_on,
                ],
              },
            ],
            note:
              "辅助展示不参与排序。accuracy_stderr 是官网发布的标准误，不是 95% 置信区间半宽。官网 accuracy 在 n_trials 次尝试上汇总，与 EvalHub 主分 mean@3 的估计量不同，不能直接等同。",
          },
        ],
        detail:
          `Terminal-Bench 2.1 官网榜单于 ${snapshot.retrieved_on} 公开的成绩：` +
          `${entry.harness} · ${entry.model} · accuracy ${entry.accuracy_pct}%，` +
          `官网发布标准误 ± ${entry.accuracy_stderr_pct}%（非 95% 置信区间），` +
          `在 ${entry.n_trials} 次尝试上汇总，官网名次 ${entry.rank}，标注日期 ${entry.published_on}。` +
          `官网 accuracy 与 EvalHub 主分 mean@3 的估计量不同，不能直接等同。` +
          `该记录只复现钉死的上游公开结果，不表示 EvalHub 独立复跑，也不代表 Terminal-Bench ` +
          `官方或 Harbor 维护者对 EvalHub 的认证或背书。`,
      },
    ],
  };
}

function validateEnvelope(result) {
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
    `信封无法通过共享 schema：${envelope.error?.message ?? "未知错误"}`,
  );
  const contextual = validateResultForEval(evalDefinition, envelope.data);
  assert(
    contextual.success,
    `信封与 eval.yaml 不一致：${contextual.error?.message ?? "未知错误"}`,
  );
  assert(
    typeof envelope.data.results[0].score === "number",
    "upstream_author_publication 必须带非空数值 score",
  );
}

function writeAtomically(targetPath, result) {
  let targetDirectory;
  try {
    targetDirectory = realpathSync(dirname(targetPath));
  } catch (error) {
    throw new InputError(`输出目录无法读取：${error.message}`);
  }
  const target = resolve(targetDirectory, basename(targetPath));
  assert(
    target !== realpathSync(fileURLToPath(SNAPSHOT_URL)),
    "输出文件不能覆盖钉死的官网快照",
  );
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
  const snapshot = loadSnapshot();
  const entry = snapshot.entries.find(
    (candidate) => candidate.participant_id === args.participant,
  );
  assert(entry !== undefined, `未知研究者 ${args.participant}`);
  const envelope = buildEnvelope(snapshot, entry, args.evalCommit);
  validateEnvelope(envelope);
  const target = writeAtomically(resolve(args.out), envelope);
  console.log(
    `official-result-to-envelope: ${entry.harness} · ${entry.model} · ` +
      `${entry.accuracy_pct}% → ${target}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`official-result-to-envelope: ${message}`);
  process.exitCode = 1;
}
