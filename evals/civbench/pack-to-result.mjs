#!/usr/bin/env node

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const EVAL_ID = "civbench";
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "dd2019056371b92ea4854e879ddf05a8cad95e8a";
const RUNNER_VERSION = "civbench/ground-control-pack@1.0.0";
const MANIFEST_MAX_BYTES = 1024 * 1024;
const MAX_GAMES = 100;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/u;
const IDENTITY_PATTERN = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;

const DIMENSIONS = Object.freeze([
  Object.freeze({ key: "overall", label: "Overall Score" }),
  Object.freeze({ key: "economic", label: "Economic Management" }),
  Object.freeze({ key: "military", label: "Military Competence" }),
  Object.freeze({ key: "scientific", label: "Scientific Progress" }),
  Object.freeze({ key: "diplomatic", label: "Diplomatic Skill" }),
  Object.freeze({ key: "spatial", label: "Spatial Reasoning" }),
  Object.freeze({ key: "toolFluency", label: "Tool-Use Fluency" }),
  Object.freeze({ key: "coherence", label: "Long-Horizon Coherence" }),
]);

const MANIFEST_KEYS = Object.freeze([
  "manifest_version",
  "eval_id",
  "protocol_revision",
  "upstream_commit",
  "participant",
  "run_date",
  "games",
]);
const PARTICIPANT_KEYS = Object.freeze(["model", "harness", "harness_version"]);
const GAME_KEYS = Object.freeze([
  "run_id",
  "scenario_id",
  "eval_track",
  "admissible",
  "outcome",
  "raw_game_score",
  "dimensions",
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

function requireString(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(`${label} 缺失或格式不合法`);
  }
  return value;
}

function requireFinite(value, min, max, label) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    fail(`${label} 必须是 ${min} 到 ${max} 之间的有限数值`);
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

function roundFour(value) {
  return Number(value.toFixed(4));
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseArgv(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") {
    fail("用法：node evals/civbench/pack-to-result.mjs <submission.json> --out <result.json>");
  }
  if (!argv[0] || !argv[2]?.endsWith(".json")) {
    fail("输入路径不能为空，输出路径必须以 .json 结尾");
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
  try {
    return JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (error) {
    fail(`提交清单不是合法 JSON：${error.message}`);
  }
}

function validateParticipant(raw) {
  const participant = plainObject(raw, "participant");
  onlyKnownKeys(participant, PARTICIPANT_KEYS, "participant");
  return {
    model: requireString(participant.model, IDENTITY_PATTERN, "participant.model"),
    harness: requireString(participant.harness, IDENTITY_PATTERN, "participant.harness"),
    harness_version: requireString(
      participant.harness_version,
      IDENTITY_PATTERN,
      "participant.harness_version",
    ),
  };
}

function validateGame(raw, index) {
  const label = `games[${index}]`;
  const game = plainObject(raw, label);
  onlyKnownKeys(game, GAME_KEYS, label);
  const runId = requireString(game.run_id, RUN_ID_PATTERN, `${label}.run_id`);
  if (game.scenario_id !== "ground_control") {
    fail(`${label}.scenario_id 必须是 ground_control`);
  }
  if (game.eval_track !== "civbench_standard") {
    fail(`${label}.eval_track 必须是 civbench_standard`);
  }
  if (game.admissible !== true) {
    fail(`${label}.admissible 只接受 true`);
  }
  if (game.outcome !== "victory" && game.outcome !== "defeat") {
    fail(`${label}.outcome 必须是 victory 或 defeat`);
  }
  const rawGameScore = requireFinite(
    game.raw_game_score,
    0,
    10_000_000,
    `${label}.raw_game_score`,
  );
  const dimensions = plainObject(game.dimensions, `${label}.dimensions`);
  onlyKnownKeys(
    dimensions,
    DIMENSIONS.map(({ key }) => key),
    `${label}.dimensions`,
  );
  const dimensionValues = {};
  for (const { key } of DIMENSIONS) {
    dimensionValues[key] = requireFinite(
      dimensions[key],
      0,
      100,
      `${label}.dimensions.${key}`,
    );
  }
  return {
    runId,
    outcome: game.outcome,
    rawGameScore,
    dimensions: dimensionValues,
    gameScore: mean(DIMENSIONS.map(({ key }) => dimensionValues[key])),
  };
}

function validateManifest(raw) {
  const manifest = plainObject(raw, "提交清单");
  onlyKnownKeys(manifest, MANIFEST_KEYS, "提交清单");
  if (manifest.manifest_version !== 1) fail("manifest_version 目前只支持 1");
  if (manifest.eval_id !== EVAL_ID) fail(`eval_id 必须是 ${EVAL_ID}`);
  if (manifest.protocol_revision !== PROTOCOL_REVISION) {
    fail(`protocol_revision 必须是 ${PROTOCOL_REVISION}`);
  }
  if (manifest.upstream_commit !== UPSTREAM_COMMIT) {
    fail("upstream_commit 必须是本协议钉死的 Civ6-MCP commit");
  }
  const runDate = requireString(manifest.run_date, CALENDAR_DATE_PATTERN, "run_date");
  if (!isRealCalendarDate(runDate)) fail("run_date 必须是真实存在的日期");
  const participant = validateParticipant(manifest.participant);
  if (!Array.isArray(manifest.games) || manifest.games.length < 1) {
    fail("games 必须是至少包含一局的数组");
  }
  if (manifest.games.length > MAX_GAMES) {
    fail(`games 最多包含 ${MAX_GAMES} 局`);
  }
  const games = manifest.games.map(validateGame);
  const seen = new Set();
  for (const game of games) {
    if (seen.has(game.runId)) fail(`games 中 run_id ${game.runId} 重复`);
    seen.add(game.runId);
  }
  return { participant, runDate, games };
}

function buildMetricTable(games, score) {
  const dimensionRows = DIMENSIONS.map(({ key, label }) => ({
    cells: [label, roundFour(mean(games.map((game) => game.dimensions[key])))],
  }));
  const wins = games.filter((game) => game.outcome === "victory").length;
  const losses = games.length - wins;
  return {
    type: "metric_table",
    id: "ground-control-scorecard",
    label: "Ground Control 分项",
    title: "Ground Control 八维、主分与运行覆盖",
    columns: ["指标", "均值或记录"],
    rows: [
      ...dimensionRows,
      { cells: ["派生主分", score] },
      { cells: ["原始游戏分均值", roundFour(mean(games.map((game) => game.rawGameScore)))] },
      { cells: ["入选局数", games.length] },
      { cells: ["胜 / 负", `${wins} / ${losses}`] },
    ],
    note: "八维均值、原始游戏分、局数与胜负来自提交清单。派生主分 = 每局八维算术平均，再对全部入选局取算术平均。只有结果条目的 score 参与排名；本表是辅助展示。打包器验证结构和算术，不验证外部运行、admissible 判定或分项来源。",
  };
}

function buildResult(validated) {
  const score = roundFour(mean(validated.games.map((game) => game.gameScore)));
  const runIds = validated.games.map((game) => game.runId).join(", ");
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
        detail: `Ground Control standard-track 派生分；${validated.games.length} 局，run_id: ${runIds}。本地打包器只复核清单结构与算术，不代表 EvalHub 复跑或验证外部证据。`,
        supplementary_views: [buildMetricTable(validated.games, score)],
      },
    ],
  };
}

function main() {
  const paths = parseArgv(process.argv.slice(2));
  const result = buildResult(validateManifest(readManifest(paths.input)));
  writeFileSync(paths.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`civbench pack error: ${message}\n`);
  process.exitCode = 1;
}
