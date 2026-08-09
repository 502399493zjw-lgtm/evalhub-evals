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

const EVAL_ID = "civ6-civbench";
const RUNNER_VERSION = "civ6-civbench/pack-to-result@1.0.0";
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "dd2019056371b92ea4854e879ddf05a8cad95e8a";
const TRACK = "civbench_standard";
const MANIFEST_MAX_BYTES = 512 * 1024;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._/:+-]{1,255}$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]{3,128}$/u;
const IDENTITY_TEXT_PATTERN = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const OUTCOME_VALUES = Object.freeze(["victory", "defeat", "turn-limit", "failed"]);
const TOP_LEVEL_KEYS = Object.freeze([
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "upstream_commit",
  "track",
  "participant",
  "run_date",
  "scenarios",
]);
const PARTICIPANT_KEYS = Object.freeze(["model", "harness", "harness_version"]);
const SCENARIO_KEYS = Object.freeze([
  "task_id",
  "run_id",
  "outcome",
  "terminal_turn",
  "metrics",
  "evidence",
]);
const OUTCOME_KEYS = Object.freeze([
  "result",
  "winner_civilization",
  "winner_leader",
  "victory_type",
]);
const EVIDENCE_KEYS = Object.freeze([
  "inspect_eval_sha256",
  "telemetry_manifest_sha256",
  "diary_sha256",
  "log_sha256",
]);
const COMMON_METRIC_KEYS = Object.freeze([
  "overall_score",
  "economic",
  "military",
  "scientific",
  "cultural",
  "spatial",
  "diplomatic",
  "tool_fluency",
  "turns_played",
]);
const SCENARIOS = Object.freeze({
  "ground-control": Object.freeze({
    label: "Ground Control",
    playerCivilization: "Babylon",
    playerLeader: "Hammurabi",
    metricKeys: Object.freeze([
      "victory_check_freq",
      "victory_check_count",
      "great_people_check_count",
      "spaceport_turn",
      "space_project_count",
    ]),
  }),
  snowflake: Object.freeze({
    label: "Snowflake",
    playerCivilization: "Korea",
    playerLeader: "Seondeok",
    metricKeys: Object.freeze([
      "cities_t50",
      "cities_t100",
      "cities_t150",
      "cities_t200",
      "map_scan_freq",
      "map_scan_count",
      "victory_check_count",
      "seowon_count",
      "military_unit_count",
      "exploration_pct",
    ]),
  }),
  "cry-havoc": Object.freeze({
    label: "Cry Havoc",
    playerCivilization: "Sumeria",
    playerLeader: "Gilgamesh",
    metricKeys: Object.freeze([
      "first_attack_turn",
      "war_carts_by_t25",
      "ziggurat_count",
      "military_in_first_5_builds",
      "cities_captured_by_t40",
    ]),
  }),
});

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

function requireNullableString(value, label) {
  if (value === null) return null;
  return requireString(value, IDENTITY_TEXT_PATTERN, label);
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

function roundSix(value) {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function parseArgv(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") {
    fail("用法：node evals/civ6-civbench/pack-to-result.mjs <submission.json> --out <result.json>");
  }
  if (typeof argv[0] !== "string" || argv[0].length === 0) fail("缺少提交清单路径");
  if (typeof argv[2] !== "string" || !argv[2].endsWith(".json")) {
    fail("输出路径必须以 .json 结尾");
  }
  const input = resolve(argv[0]);
  const output = resolve(argv[2]);
  if (input === output) fail("输入与输出路径不能相同");
  return { input, output };
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

function validateOutcome(raw, taskId, index) {
  const outcome = plainObject(raw, `scenarios[${index}].outcome`);
  onlyKnownKeys(outcome, OUTCOME_KEYS, `scenarios[${index}].outcome`);
  if (!OUTCOME_VALUES.includes(outcome.result)) {
    fail(`scenarios[${index}].outcome.result 必须是 ${OUTCOME_VALUES.join(" / ")}`);
  }
  const winnerCivilization = requireNullableString(
    outcome.winner_civilization,
    `scenarios[${index}].outcome.winner_civilization`,
  );
  const winnerLeader = requireNullableString(
    outcome.winner_leader,
    `scenarios[${index}].outcome.winner_leader`,
  );
  const victoryType = requireNullableString(
    outcome.victory_type,
    `scenarios[${index}].outcome.victory_type`,
  );
  const hasWinner = winnerCivilization !== null && winnerLeader !== null && victoryType !== null;
  if ((outcome.result === "victory" || outcome.result === "defeat") && !hasWinner) {
    fail(`scenarios[${index}] 的胜负结局必须写明赢家文明、领袖和胜利类型`);
  }
  if ((outcome.result === "turn-limit" || outcome.result === "failed") && hasWinner) {
    fail(`scenarios[${index}] 未产生胜负时，赢家文明、领袖和胜利类型必须全部为 null`);
  }
  if (!hasWinner && [winnerCivilization, winnerLeader, victoryType].some((value) => value !== null)) {
    fail(`scenarios[${index}] 的三个赢家字段必须同时填写或同时为 null`);
  }
  if (hasWinner) {
    const spec = SCENARIOS[taskId];
    const playerWon =
      winnerCivilization === spec.playerCivilization && winnerLeader === spec.playerLeader;
    if (outcome.result === "victory" && !playerWon) {
      fail(`scenarios[${index}] 标记 victory 时，赢家必须是该场景的参赛文明与领袖`);
    }
    if (outcome.result === "defeat" && playerWon) {
      fail(`scenarios[${index}] 标记 defeat 时，赢家不能是该场景的参赛文明与领袖`);
    }
  }
  return {
    result: outcome.result,
    winner_civilization: winnerCivilization,
    winner_leader: winnerLeader,
    victory_type: victoryType,
  };
}

function validateMetrics(raw, taskId, outcomeResult, index) {
  if (outcomeResult === "failed") {
    if (raw !== null) fail(`scenarios[${index}].metrics 在 failed 时必须为 null`);
    return null;
  }
  const metrics = plainObject(raw, `scenarios[${index}].metrics`);
  const scenarioMetricKeys = SCENARIOS[taskId].metricKeys;
  onlyKnownKeys(metrics, [...COMMON_METRIC_KEYS, ...scenarioMetricKeys], `scenarios[${index}].metrics`);
  const result = {};
  for (const key of COMMON_METRIC_KEYS) {
    const max = key === "tool_fluency" ? 1 : key === "turns_played" ? 330 : 1_000_000_000;
    result[key] = requireFinite(metrics[key], 0, max, `scenarios[${index}].metrics.${key}`);
  }
  for (const key of scenarioMetricKeys) {
    result[key] = requireFinite(
      metrics[key],
      -1,
      1_000_000_000,
      `scenarios[${index}].metrics.${key}`,
    );
  }
  return result;
}

function validateEvidence(raw, outcomeResult, index) {
  const evidence = plainObject(raw, `scenarios[${index}].evidence`);
  onlyKnownKeys(evidence, EVIDENCE_KEYS, `scenarios[${index}].evidence`);
  const result = {};
  for (const key of EVIDENCE_KEYS) {
    const value = evidence[key];
    if (value === null && outcomeResult === "failed" && key !== "log_sha256") {
      result[key] = null;
      continue;
    }
    result[key] = requireString(value, SHA256_PATTERN, `scenarios[${index}].evidence.${key}`);
  }
  return result;
}

function validateScenario(raw, index) {
  const scenario = plainObject(raw, `scenarios[${index}]`);
  onlyKnownKeys(scenario, SCENARIO_KEYS, `scenarios[${index}]`);
  const taskId = requireString(
    scenario.task_id,
    /^[a-z0-9][a-z0-9-]{0,63}$/u,
    `scenarios[${index}].task_id`,
  );
  if (!(taskId in SCENARIOS)) fail(`scenarios[${index}].task_id 不在固定三场中`);
  const runId = requireString(scenario.run_id, RUN_ID_PATTERN, `scenarios[${index}].run_id`);
  const outcome = validateOutcome(scenario.outcome, taskId, index);
  const terminalTurn = requireInteger(
    scenario.terminal_turn,
    outcome.result === "failed" ? 0 : 1,
    330,
    `scenarios[${index}].terminal_turn`,
  );
  const metrics = validateMetrics(scenario.metrics, taskId, outcome.result, index);
  if (metrics !== null && Math.abs(terminalTurn - metrics.turns_played) > 1) {
    fail(`scenarios[${index}] 的 terminal_turn 与 metrics.turns_played 必须相差不超过 1`);
  }
  const evidence = validateEvidence(scenario.evidence, outcome.result, index);
  return { taskId, runId, outcome, terminalTurn, metrics, evidence };
}

function validateManifest(raw) {
  const manifest = plainObject(raw, "提交清单");
  onlyKnownKeys(manifest, TOP_LEVEL_KEYS, "提交清单");
  if (manifest.manifest_version !== 1) fail("manifest_version 必须是 1");
  if (manifest.eval_id !== EVAL_ID) fail(`eval_id 必须是 ${EVAL_ID}`);
  if (manifest.protocol_revision !== PROTOCOL_REVISION) {
    fail(`protocol_revision 必须是 ${PROTOCOL_REVISION}`);
  }
  if (manifest.upstream_commit !== UPSTREAM_COMMIT) {
    fail(`upstream_commit 必须是 ${UPSTREAM_COMMIT}`);
  }
  if (manifest.track !== TRACK) fail(`track 必须是 ${TRACK}`);
  const participant = validateParticipant(manifest.participant);
  const runDate = requireString(manifest.run_date, CALENDAR_DATE_PATTERN, "run_date");
  if (!isRealCalendarDate(runDate)) fail("run_date 必须是真实存在的 YYYY-MM-DD 日期");
  if (!Array.isArray(manifest.scenarios) || manifest.scenarios.length !== 3) {
    fail("scenarios 必须恰好包含三个固定场景");
  }
  const scenarios = manifest.scenarios.map(validateScenario);
  const taskIds = new Set(scenarios.map((scenario) => scenario.taskId));
  if (taskIds.size !== 3 || Object.keys(SCENARIOS).some((taskId) => !taskIds.has(taskId))) {
    fail("scenarios.task_id 不可重复，且必须完整覆盖三个固定场景");
  }
  const runIds = new Set(scenarios.map((scenario) => scenario.runId));
  if (runIds.size !== 3) fail("三个场景必须使用不同的 run_id");
  const hashes = scenarios.flatMap((scenario) => Object.values(scenario.evidence)).filter(Boolean);
  if (new Set(hashes).size !== hashes.length) fail("每个证据文件必须使用不同的 SHA-256");
  scenarios.sort(
    (left, right) => Object.keys(SCENARIOS).indexOf(left.taskId) - Object.keys(SCENARIOS).indexOf(right.taskId),
  );
  return { participant, runDate, scenarios };
}

function metricValue(scenario, key) {
  return scenario.metrics === null ? null : scenario.metrics[key];
}

function buildResult(validated, manifestDigest) {
  const victories = validated.scenarios.filter(
    (scenario) => scenario.outcome.result === "victory",
  ).length;
  const score = roundSix((victories / 3) * 100);
  const outcomes = validated.scenarios.map((scenario) => ({
    taskId: scenario.taskId,
    label: SCENARIOS[scenario.taskId].label,
    points: scenario.outcome.result === "victory" ? 100 : 0,
    result: scenario.outcome.result,
    turn: scenario.terminalTurn,
    winner: scenario.outcome.winner_civilization,
    victoryType: scenario.outcome.victory_type,
  }));
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
          label: "三个固定场景胜率",
          value: `${score.toFixed(6)} 分`,
        },
        detail:
          `Derived: 主分 = 胜利场景数 ${victories} ÷ 固定场景数 3 × 100 = ${score.toFixed(6)}。` +
          `非胜利场景统一计 0；相同分数并列。上游 commit ${UPSTREAM_COMMIT}，标准赛道 ${TRACK}。` +
          `提交清单 sha256=${manifestDigest}。转换成功只代表结构与固定协议字段合规，成绩仍须作者核对原始证据。`,
        task_results: outcomes.map((outcome) => ({
          task_id: outcome.taskId,
          score: outcome.points,
          raw:
            `${outcome.result} · turn ${outcome.turn}` +
            (outcome.winner ? ` · ${outcome.winner} · ${outcome.victoryType}` : ""),
        })),
        supplementary_views: [
          {
            type: "metric_table",
            id: "run-scenario-outcomes",
            label: "三场结局",
            title: "本次运行的三个场景结局",
            columns: ["场景", "结局", "计分", "终止回合", "赢家文明", "胜利类型"],
            rows: outcomes.map((outcome) => ({
              cells: [
                outcome.label,
                outcome.result,
                outcome.points,
                outcome.turn,
                outcome.winner,
                outcome.victoryType,
              ],
            })),
            note: "victory 计 100，其余结局计 0；三行算术平均即主分。辅助展示不另行参与排名。",
          },
          {
            type: "metric_table",
            id: "run-upstream-common-metrics",
            label: "通用指标",
            title: "上游 CivBench scorer 的通用指标",
            columns: [
              "场景",
              "游戏内分数",
              "经济",
              "军事",
              "科技",
              "文化",
              "空间",
              "外交",
              "工具流畅度",
              "已玩回合",
            ],
            rows: validated.scenarios.map((scenario) => ({
              cells: [
                SCENARIOS[scenario.taskId].label,
                metricValue(scenario, "overall_score"),
                metricValue(scenario, "economic"),
                metricValue(scenario, "military"),
                metricValue(scenario, "scientific"),
                metricValue(scenario, "cultural"),
                metricValue(scenario, "spatial"),
                metricValue(scenario, "diplomatic"),
                metricValue(scenario, "tool_fluency"),
                metricValue(scenario, "turns_played"),
              ],
            })),
            note: "逐场保留上游 scorer 输出；这些动作计数与产出代理只解释运行，不进入懂模帝主分。failed 场景没有 scorer 输出时保留 null。",
          },
          {
            type: "metric_table",
            id: "run-upstream-scenario-metrics",
            label: "场景指标",
            title: "上游 CivBench scorer 的场景专属指标",
            columns: ["场景", "指标", "值"],
            rows: validated.scenarios.flatMap((scenario) =>
              SCENARIOS[scenario.taskId].metricKeys.map((key) => ({
                cells: [SCENARIOS[scenario.taskId].label, key, metricValue(scenario, key)],
              })),
            ),
            note: "指标名称与场景归属来自钉死 commit 的 evals/metrics.py；值从本次 Inspect 结果转录，不参与懂模帝主分。",
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
  console.error(`civ6-civbench pack failed: ${message}`);
  process.exitCode = 1;
}
