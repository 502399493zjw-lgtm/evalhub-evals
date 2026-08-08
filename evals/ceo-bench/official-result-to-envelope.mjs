import {
  lstatSync,
  mkdirSync,
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

const EVAL_ID = "ceo-bench";
const IMPORTER_VERSION = "ceo-bench/official-result-to-envelope@1.3.0";
const SNAPSHOT_URL = new URL(
  "./tasks/princeton-official-results-2026-08-03.json",
  import.meta.url,
);

/**
 * 上游官网的写法不总能唯一确定平台侧的模型身份。这里只收敛"歧义标签 →
 * 平台已登记身份"，不做相似度猜测：平台注册表故意不给 "Gemini 3 Flash" 建
 * 全局 alias（同名可能指 preview 也可能指后续 GA），只对指纹匹配的 CEO-Bench
 * 快照做绑定。本快照 sha256 97475ea0… 已被平台按该指纹判定为
 * google/gemini-3-flash-preview，所以 envelope 直接写无歧义的身份。
 *
 * 上游原始写法不进 envelope，只留在钉死的 tasks/princeton-official-results-*.json
 * 的 model_display 里 —— 那份快照连同它的页面 sha256 才是溯源依据，envelope 里
 * 再写一遍歧义标签只会让平台又解析不了。
 */
const PLATFORM_MODEL_IDENTITY = new Map([
  ["Gemini 3 Flash", "Gemini 3 Flash Preview"],
]);

function platformModelIdentity(modelDisplay) {
  return PLATFORM_MODEL_IDENTITY.get(modelDisplay) ?? modelDisplay;
}
const EVAL_COMMIT_PATTERN = /^[a-f0-9]{7,40}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MEAN_SURVIVAL_PATTERN = /^\d{1,3}\.\d ± \d{1,3}\.\d$/u;
const TURNS_PER_WEEK_PATTERN = /^\d{1,3}\.\d{2}$/u;

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

function assert(condition, message) {
  if (!condition) throw new InputError(message);
}

function parseArgs(argv) {
  const parsed = {
    participant: null,
    out: null,
    outDir: null,
    all: false,
    evalCommit: null,
  };
  const valueArgs = new Set([
    "--participant",
    "--out",
    "--out-dir",
    "--eval-commit",
  ]);
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    assert(token === "--all" || valueArgs.has(token), `未知参数 ${token}`);
    assert(!seen.has(token), `参数 ${token} 不能重复`);
    seen.add(token);
    if (token === "--all") {
      parsed.all = true;
      continue;
    }
    const value = argv[index + 1];
    assert(value !== undefined && !value.startsWith("--"), `参数 ${token} 缺少值`);
    if (token === "--participant") parsed.participant = value;
    else if (token === "--out") parsed.out = value;
    else if (token === "--out-dir") parsed.outDir = value;
    else parsed.evalCommit = value;
    index += 1;
  }
  if (parsed.all) {
    assert(parsed.outDir !== null, "--all 模式缺少 --out-dir");
    assert(
      parsed.participant === null && parsed.out === null,
      "--all 不能与 --participant 或 --out 同用",
    );
  } else {
    assert(parsed.participant !== null, "缺少 --participant");
    assert(parsed.out !== null, "缺少 --out");
    assert(parsed.outDir === null, "单条模式不能使用 --out-dir");
  }
  if (parsed.evalCommit !== null) {
    assert(
      EVAL_COMMIT_PATTERN.test(parsed.evalCommit),
      "--eval-commit 必须是 7–40 位小写十六进制 Git commit",
    );
  }
  return parsed;
}

function participantId(result) {
  if (result.manifest_model !== null) return result.manifest_model;
  return result.model_display
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function readSnapshot() {
  let snapshot;
  try {
    snapshot = JSON.parse(readFileSync(SNAPSHOT_URL, "utf8"));
  } catch (error) {
    throw new InputError(`官方成绩快照无法读取：${error.message}`);
  }
  assert(snapshot?.schema_version === 2, "官方成绩快照 schema_version 必须是 2");
  assert(snapshot?.benchmark === EVAL_ID, `官方成绩快照 benchmark 必须是 ${EVAL_ID}`);
  assert(
    snapshot?.source_kind === "upstream_official_publication",
    "官方成绩快照 source_kind 不正确",
  );
  assert(/^\d{4}-\d{2}-\d{2}$/u.test(snapshot?.retrieved_on), "官方成绩快照 retrieved_on 不正确");
  assert(
    /^\d{4}-\d{2}-\d{2}$/u.test(snapshot?.reverified_on),
    "官方成绩快照 reverified_on 不正确",
  );
  assert(
    snapshot.reverified_on >= snapshot.retrieved_on,
    "官方成绩快照 reverified_on 不能早于 retrieved_on",
  );
  assert(typeof snapshot?.score_authority?.url === "string", "官方成绩快照缺少来源 URL");
  assert(
    SHA256_PATTERN.test(snapshot?.score_authority?.sha256),
    "官方成绩快照缺少合法页面 SHA-256",
  );
  assert(
    Array.isArray(snapshot?.results) && snapshot.results.length === 18,
    "官方成绩快照必须恰好包含 18 个模型",
  );
  assert(
    Array.isArray(snapshot?.references) && snapshot.references.length === 2,
    "官方成绩快照必须包含规则基线和估算上界两项参考值",
  );
  const referenceKinds = new Set();
  for (const reference of snapshot.references) {
    assert(
      reference?.reference_kind === "rule_based_baseline" ||
        reference?.reference_kind === "estimated_upper_bound",
      "官方成绩参考值 reference_kind 不合法",
    );
    assert(
      !referenceKinds.has(reference.reference_kind),
      `重复的官方成绩参考值 ${reference.reference_kind}`,
    );
    referenceKinds.add(reference.reference_kind);
    assert(
      typeof reference?.label === "string" && reference.label.length > 0,
      `${reference.reference_kind}.label 不合法`,
    );
    assert(
      Number.isSafeInteger(reference?.score_usd) && reference.score_usd > 0,
      `${reference.reference_kind}.score_usd 必须是正安全整数`,
    );
    assert(
      reference?.participant === false,
      `${reference.reference_kind} 只能是非参赛参考值`,
    );
  }

  const ids = new Set();
  const names = new Set();
  for (const result of snapshot.results) {
    assert(
      typeof result?.model_display === "string" && result.model_display.length >= 4,
      "model_display 不合法",
    );
    const id = participantId(result);
    assert(id.length > 0 && !ids.has(id), `重复或非法 participant id ${id}`);
    assert(!names.has(result.model_display), `重复 model_display ${result.model_display}`);
    ids.add(id);
    names.add(result.model_display);
    assert(
      Number.isSafeInteger(result.score_usd) && result.score_usd >= 0,
      `${id}.score_usd 必须是非负安全整数`,
    );
    assert(result.run_count === 3, `${id}.run_count 必须是 3`);
    assert(
      Number.isSafeInteger(result.bankrupt_runs) &&
        result.bankrupt_runs >= 0 &&
        result.bankrupt_runs <= 3,
      `${id}.bankrupt_runs 不合法`,
    );
    assert(
      Number.isSafeInteger(result.homepage_max_survival_days) &&
        result.homepage_max_survival_days >= 0 &&
        result.homepage_max_survival_days <= 500,
      `${id}.homepage_max_survival_days 不合法`,
    );
    assert(
      typeof result.homepage_mean_survival_days === "string" &&
        MEAN_SURVIVAL_PATTERN.test(result.homepage_mean_survival_days),
      `${id}.homepage_mean_survival_days 必须保留官网的一位小数 ± 一位小数显示值`,
    );
    const [meanSurvival, survivalSpread] = result.homepage_mean_survival_days
      .split(" ± ")
      .map(Number);
    assert(
      meanSurvival >= 0 &&
        meanSurvival <= 500 &&
        survivalSpread >= 0 &&
        survivalSpread <= 500,
      `${id}.homepage_mean_survival_days 超出 0–500 天范围`,
    );
    assert(
      typeof result.homepage_turns_per_week === "string" &&
        TURNS_PER_WEEK_PATTERN.test(result.homepage_turns_per_week) &&
        Number(result.homepage_turns_per_week) > 0,
      `${id}.homepage_turns_per_week 必须保留官网的两位小数正数显示值`,
    );
    if (result.scoring_status === "all_runs_bankrupt") {
      assert(
        result.bankrupt_runs === 3 && result.score_usd === 0,
        `${id} 的全破产状态与成绩不一致`,
      );
    } else {
      assert(result.scoring_status === "has_completed_run", `${id}.scoring_status 不合法`);
      assert(
        result.bankrupt_runs < 3 && result.score_usd > 0,
        `${id} 的完成状态与成绩不一致`,
      );
    }
  }
  return snapshot;
}

function buildEnvelope(snapshot, result, evalCommit) {
  const allBankrupt = result.scoring_status === "all_runs_bankrupt";
  return {
    eval_id: EVAL_ID,
    ...(evalCommit === null ? {} : { eval_commit: evalCommit }),
    submission: {
      kind: "upstream_author_publication",
      importer_version: IMPORTER_VERSION,
      retrieved_on: snapshot.retrieved_on,
      source: {
        title: "Princeton CEO-Bench official results",
        url: snapshot.score_authority.url,
        snapshot_sha256: snapshot.score_authority.sha256,
      },
    },
    results: [
      {
        participant: { model: platformModelIdentity(result.model_display) },
        score: result.score_usd,
        raw_metric: {
          label: "Princeton 官网公开成绩",
          value: allBankrupt
            ? "0 USD · 三次均破产"
            : `${result.score_usd.toLocaleString("en-US")} USD · 至少一次完成`,
          tiebreak_value: result.homepage_max_survival_days,
        },
        supplementary_views: [
          {
            type: "metric_table",
            id: "official-run-summary",
            label: "运行摘要",
            title: "Princeton 官网运行摘要",
            columns: [
              "运行数",
              "破产运行",
              "最长存活天数",
              "平均存活天数",
              "Turns/week",
              "官网状态",
            ],
            rows: [
              {
                cells: [
                  result.run_count,
                  result.bankrupt_runs,
                  result.homepage_max_survival_days,
                  result.homepage_mean_survival_days,
                  result.homepage_turns_per_week,
                  allBankrupt ? "三次均破产" : "至少一次完成",
                ],
              },
            ],
            note: "数值逐项转录自 Princeton 官网结果表，辅助展示不参与主分排序；同为 0 USD 时，最长存活天数按评测定义用于打破同分。",
          },
          {
            type: "metric_table",
            id: "official-reference-values",
            label: "参考值",
            title: "Princeton 官网参考值（非模型成绩）",
            columns: ["参考项", "公开金额", "性质"],
            rows: snapshot.references.map((reference) => ({
              cells: [
                reference.label,
                `${reference.score_usd.toLocaleString("en-US")} USD`,
                reference.reference_kind === "rule_based_baseline"
                  ? "规则策略基线"
                  : "估算上界（非运行成绩）",
              ],
            })),
            note: "这两项是上游官网的全局参考值，仅用于解读模型主分；估算上界不是模型、基线实跑或 EvalHub 成绩。",
          },
        ],
        detail:
          `Princeton CEO-Bench 官网于 ${snapshot.retrieved_on} 公开的模型级成绩：` +
          `${result.score_usd.toLocaleString("en-US")} USD，${result.run_count} 次运行中 ${result.bankrupt_runs} 次破产，` +
          `官网最长存活 ${result.homepage_max_survival_days} 天，平均存活 ${result.homepage_mean_survival_days} 天，` +
          `Turns/week 为 ${result.homepage_turns_per_week}。该记录只复现钉死的上游公开结果，不表示 EvalHub 独立复跑。`,
      },
    ],
  };
}

function readEvalDefinition() {
  try {
    return EvalDefSchema.parse(
      parseYaml(readFileSync(new URL("./eval.yaml", import.meta.url), "utf8")),
    );
  } catch (error) {
    throw new InputError(`eval.yaml 无法通过共享 schema：${error.message}`);
  }
}

function validateEnvelope(evalDefinition, result) {
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
  const snapshot = readSnapshot();
  const evalDefinition = readEvalDefinition();
  const selected = args.all
    ? snapshot.results
    : snapshot.results.filter(
        (result) => participantId(result) === args.participant,
      );
  assert(selected.length > 0, `未知模型 ${args.participant}`);
  if (args.all) mkdirSync(resolve(args.outDir), { recursive: true });

  for (const result of selected) {
    const envelope = buildEnvelope(snapshot, result, args.evalCommit);
    validateEnvelope(evalDefinition, envelope);
    const target = writeAtomically(
      args.all
        ? resolve(args.outDir, `${participantId(result)}.json`)
        : args.out,
      envelope,
    );
    console.log(
      `official-result-to-envelope: ${result.model_display} → ${result.score_usd} USD → ${target}`,
    );
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`official-result-to-envelope: ${message}`);
  process.exitCode = 1;
}
