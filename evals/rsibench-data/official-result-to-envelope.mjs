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
const IMPORTER_VERSION = "rsibench-data/official-result-to-envelope@1.3.0";
const SNAPSHOT_URL = new URL(
  "./tasks/rsibench-official-results-2026-07-31.json",
  import.meta.url,
);
const EVAL_COMMIT_PATTERN = /^[a-f0-9]{7,40}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

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
  return Number(value.toFixed(6));
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
    assert(EVAL_COMMIT_PATTERN.test(parsed.evalCommit), "--eval-commit 必须是 7–40 位小写十六进制 Git commit");
  }
  return parsed;
}

function readSnapshot() {
  let value;
  try {
    value = JSON.parse(readFileSync(SNAPSHOT_URL, "utf8"));
  } catch (error) {
    throw new InputError(`官方成绩快照无法读取：${error.message}`);
  }
  assert(value?.schema_version === 1, "官方成绩快照 schema_version 必须是 1");
  assert(value?.benchmark === EVAL_ID, `官方成绩快照 benchmark 必须是 ${EVAL_ID}`);
  assert(
    value?.source_kind === "upstream_official_publication",
    "官方成绩快照 source_kind 不正确",
  );
  assert(/^\d{4}-\d{2}-\d{2}$/u.test(value?.retrieved_on), "官方成绩快照 retrieved_on 不正确");
  assert(typeof value?.score_authority?.url === "string", "官方成绩快照缺少来源 URL");
  assert(
    SHA256_PATTERN.test(value?.score_authority?.snapshot_sha256),
    "官方成绩快照缺少合法页面 SHA-256",
  );
  assert(Array.isArray(value?.benchmarks) && value.benchmarks.length === 6, "官方成绩快照必须声明六个 benchmark");
  assert(Array.isArray(value?.results) && value.results.length === 4, "官方成绩快照必须恰好包含四个研究者");

  const benchmarkById = new Map();
  for (const benchmark of value.benchmarks) {
    assert(typeof benchmark?.task_id === "string", "benchmark.task_id 必须是字符串");
    assert(!benchmarkById.has(benchmark.task_id), `重复 benchmark ${benchmark.task_id}`);
    assert(
      Number.isSafeInteger(benchmark.total_trials) && benchmark.total_trials > 0,
      `${benchmark.task_id}.total_trials 必须是正整数`,
    );
    benchmarkById.set(benchmark.task_id, benchmark);
  }

  const constants = value?.protocol_constants;
  assert(
    Number.isSafeInteger(constants?.wall_time_budget_sec) &&
      constants.wall_time_budget_sec > 0,
    "protocol_constants.wall_time_budget_sec 必须是正整数秒",
  );
  assert(
    typeof constants?.tinker_cost_budget_usd === "number" &&
      Number.isFinite(constants.tinker_cost_budget_usd) &&
      constants.tinker_cost_budget_usd > 0,
    "protocol_constants.tinker_cost_budget_usd 必须是正数",
  );
  assert(
    typeof constants?.target_model === "string" && constants.target_model.length > 0,
    "protocol_constants.target_model 不能为空",
  );
  assert(
    typeof constants?.source?.url === "string" &&
      constants.source.url.startsWith("https://") &&
      typeof constants?.source?.quote === "string" &&
      constants.source.quote.length > 0,
    "protocol_constants.source 必须给出 https 一手来源与原文引用",
  );

  const baseReference = value?.base_reference;
  assert(
    typeof baseReference?.label === "string" && baseReference.label.length > 0,
    "base_reference.label 不能为空",
  );
  assert(
    baseReference?.model === constants.target_model,
    "base_reference.model 必须是协议声明的目标模型",
  );
  assert(
    typeof baseReference?.note === "string" && baseReference.note.length > 0,
    "base_reference.note 必须说明它只展示、不参与排名",
  );
  assert(
    Array.isArray(baseReference?.scores) && baseReference.scores.length === 6,
    "base_reference.scores 必须覆盖六个分项",
  );
  const baseByTask = new Map();
  for (const score of baseReference.scores) {
    const benchmark = benchmarkById.get(score?.task_id);
    assert(benchmark !== undefined, `base_reference 含未知 task_id ${score?.task_id}`);
    assert(!baseByTask.has(score.task_id), `base_reference 重复 task_id ${score.task_id}`);
    assert(
      typeof score.published_percent === "number" &&
        Number.isFinite(score.published_percent) &&
        score.published_percent >= 0 &&
        score.published_percent <= 100,
      `base_reference/${score.task_id} published_percent 不合法`,
    );
    assert(
      Number.isSafeInteger(score.inferred_successful_trials) &&
        score.inferred_successful_trials >= 0 &&
        score.inferred_successful_trials <= benchmark.total_trials,
      `base_reference/${score.task_id} inferred_successful_trials 不合法`,
    );
    const exact = (score.inferred_successful_trials / benchmark.total_trials) * 100;
    assert(
      Number(exact.toFixed(2)) === score.published_percent,
      `base_reference/${score.task_id} 整数计数与官网两位小数不一致`,
    );
    baseByTask.set(score.task_id, score);
  }

  const participantIds = new Set();
  for (const result of value.results) {
    assert(typeof result?.participant_id === "string", "participant_id 必须是字符串");
    assert(!participantIds.has(result.participant_id), `重复 participant_id ${result.participant_id}`);
    participantIds.add(result.participant_id);
    assert(typeof result?.model_display === "string" && result.model_display.length > 0, "model_display 不能为空");
    assert(
      typeof result?.participant?.model === "string" &&
        result.participant.model.length > 0,
      `${result.participant_id}.participant.model 不能为空`,
    );
    assert(
      typeof result?.participant?.harness === "string" &&
        result.participant.harness.length > 0,
      `${result.participant_id}.participant.harness 不能为空`,
    );
    assert(
      result.model_display ===
        `${result.participant.harness} · ${result.participant.model}`,
      `${result.participant_id} 的 model_display 必须由 harness 与 model 组成`,
    );
    assert(Array.isArray(result?.official_scores) && result.official_scores.length === 6, `${result.participant_id} 必须包含六个官方分项`);
    const seenTasks = new Set();
    const exactScores = [];
    for (const score of result.official_scores) {
      const benchmark = benchmarkById.get(score?.task_id);
      assert(benchmark !== undefined, `${result.participant_id} 含未知 task_id ${score?.task_id}`);
      assert(!seenTasks.has(score.task_id), `${result.participant_id} 重复 task_id ${score.task_id}`);
      seenTasks.add(score.task_id);
      assert(
        typeof score.published_percent === "number" &&
          Number.isFinite(score.published_percent) &&
          score.published_percent >= 0 &&
          score.published_percent <= 100,
        `${result.participant_id}/${score.task_id} published_percent 不合法`,
      );
      assert(
        Number.isSafeInteger(score.inferred_successful_trials) &&
          score.inferred_successful_trials >= 0 &&
          score.inferred_successful_trials <= benchmark.total_trials,
        `${result.participant_id}/${score.task_id} inferred_successful_trials 不合法`,
      );
      const exact = (score.inferred_successful_trials / benchmark.total_trials) * 100;
      assert(
        Number(exact.toFixed(2)) === score.published_percent,
        `${result.participant_id}/${score.task_id} 整数计数与官网两位小数不一致`,
      );
      exactScores.push(exact);
    }
    const derived = roundSix(exactScores.reduce((sum, score) => sum + score, 0) / 6);
    assert(
      derived === result.derived_evalhub_score,
      `${result.participant_id} 派生宏平均应为 ${derived}`,
    );

    assert(
      Array.isArray(result?.resource_use) && result.resource_use.length === 6,
      `${result.participant_id} 必须包含六个分项的官方用时与成本`,
    );
    const seenUsage = new Set();
    for (const usage of result.resource_use) {
      assert(
        benchmarkById.has(usage?.task_id),
        `${result.participant_id} resource_use 含未知 task_id ${usage?.task_id}`,
      );
      assert(
        !seenUsage.has(usage.task_id),
        `${result.participant_id} resource_use 重复 task_id ${usage.task_id}`,
      );
      seenUsage.add(usage.task_id);
      assert(
        typeof usage.time_hours === "number" &&
          Number.isFinite(usage.time_hours) &&
          usage.time_hours > 0 &&
          usage.time_hours * 3600 <= constants.wall_time_budget_sec,
        `${result.participant_id}/${usage.task_id} time_hours 超出协议墙钟预算或不合法`,
      );
      assert(
        typeof usage.tinker_cost_usd === "number" &&
          Number.isFinite(usage.tinker_cost_usd) &&
          usage.tinker_cost_usd >= 0 &&
          usage.tinker_cost_usd <= constants.tinker_cost_budget_usd,
        `${result.participant_id}/${usage.task_id} tinker_cost_usd 超出协议预算或不合法`,
      );
    }
  }
  return { value, benchmarkById, baseByTask };
}

function buildEnvelope(snapshot, benchmarkById, baseByTask, result, evalCommit) {
  const usageByTask = new Map(
    result.resource_use.map((usage) => [usage.task_id, usage]),
  );
  const components = result.official_scores.map((score) => {
    const benchmark = benchmarkById.get(score.task_id);
    const usage = usageByTask.get(score.task_id);
    return {
      taskId: score.task_id,
      name: benchmark.name,
      publishedPercent: score.published_percent,
      successfulTrials: score.inferred_successful_trials,
      totalTrials: benchmark.total_trials,
      exactPercent: roundSix(
        (score.inferred_successful_trials / benchmark.total_trials) * 100,
      ),
      basePublishedPercent: baseByTask.get(score.task_id).published_percent,
      timeHours: usage.time_hours,
      tinkerCostUsd: usage.tinker_cost_usd,
    };
  });
  const scoreDetails = components.map(
    (component) =>
      `${component.name} ${component.publishedPercent}%（${component.successfulTrials}/${component.totalTrials}）`,
  );
  return {
    eval_id: EVAL_ID,
    ...(evalCommit === null ? {} : { eval_commit: evalCommit }),
    submission: {
      kind: "upstream_author_publication",
      importer_version: IMPORTER_VERSION,
      retrieved_on: snapshot.retrieved_on,
      source: {
        title: snapshot.score_authority.title,
        url: snapshot.score_authority.url,
        snapshot_sha256: snapshot.score_authority.snapshot_sha256,
      },
    },
    results: [
      {
        participant: result.participant,
        score: result.derived_evalhub_score,
        supplementary_views: [
          {
            type: "metric_table",
            id: "official-benchmark-breakdown",
            label: "分榜成绩",
            title: "RSIBench 官方六项成绩",
            columns: [
              "分项",
              "官网显示",
              "成功/试次",
              "精确分项分数",
              `基线模型官网显示（${snapshot.base_reference.model}）`,
            ],
            rows: components.map((component) => ({
              cells: [
                component.name,
                `${component.publishedPercent}%`,
                `${component.successfulTrials}/${component.totalTrials}`,
                component.exactPercent,
                `${component.basePublishedPercent}%`,
              ],
            })),
            note:
              "辅助展示，不参与单独排名；总体分是六项精确百分制分数的等权宏平均。" +
              "最后一列是官方同一张矩阵里的未微调基线模型行，仅作对照，不是参赛结果。",
          },
          {
            type: "metric_table",
            id: "official-time-cost",
            label: "时间与成本",
            title: "RSIBench 官方用时与 Tinker 成本",
            columns: ["分项", "用时（小时）", "Tinker 成本（USD）"],
            rows: components.map((component) => ({
              cells: [component.name, component.timeHours, component.tinkerCostUsd],
            })),
            note:
              `官方矩阵同表转录的资源消耗，仅作展示，不进入评分；协议名义预算为每次主运行 ${
                snapshot.protocol_constants.wall_time_budget_sec / 3600
              } 小时墙钟与 ${snapshot.protocol_constants.tinker_cost_budget_usd} USD Tinker 额度。`,
          },
        ],
        detail:
          `上游官网六项官方成绩的 EvalHub 等权宏平均：${scoreDetails.join("、")}。` +
          "括号内整数成功数由官网两位小数和固定分母唯一反推；宏平均是 EvalHub 派生指标，不是上游官方复合指标，也不表示 EvalHub 独立复跑。",
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
    `结果文件无法通过共享 schema：${envelope.error?.message ?? "未知错误"}`,
  );
  const contextual = validateResultForEval(evalDefinition, envelope.data);
  assert(
    contextual.success,
    `结果文件与 eval.yaml 不一致：${contextual.error?.message ?? "未知错误"}`,
  );
}

function writeAtomically(outputPath, result) {
  const declaredOutput = resolve(outputPath);
  try {
    if (lstatSync(declaredOutput).isSymbolicLink()) {
      throw new InputError("输出文件不能是软链接");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  let outputDirectory;
  try {
    outputDirectory = realpathSync(dirname(declaredOutput));
  } catch (error) {
    throw new InputError(`输出目录无法读取：${error.message}`);
  }
  const target = resolve(outputDirectory, basename(declaredOutput));
  const temporary = resolve(
    outputDirectory,
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
  const { value: snapshot, benchmarkById, baseByTask } = readSnapshot();
  const result = snapshot.results.find(
    (candidate) => candidate.participant_id === args.participant,
  );
  assert(result !== undefined, `未知研究者 ${args.participant}`);
  const envelope = buildEnvelope(
    snapshot,
    benchmarkById,
    baseByTask,
    result,
    args.evalCommit,
  );
  validateEnvelope(envelope);
  const target = writeAtomically(args.out, envelope);
  console.log(
    `official-result-to-envelope: ${result.model_display} → ${result.derived_evalhub_score} 分 → ${target}`,
  );
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`official-result-to-envelope: ${message}`);
  process.exitCode = 1;
}
