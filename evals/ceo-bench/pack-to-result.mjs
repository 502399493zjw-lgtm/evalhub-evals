#!/usr/bin/env node
// pack-to-result.mjs — 把一个 CEO-Bench bash-agent 运行目录转换成 EvalHub result JSON。
//
// 真实管线：本地跑 CEO-Bench harness（saas_bench.agents.bash_agent.run_test）得到
// run_<id>/ 目录后，用本脚本从运行证据（config.json / checkpoint.json /
// logs/tool_results_<id>.jsonl）中提取每周仪表盘观测，重建归档成绩文件。
// 脚本只读取证据文件，不调用任何模型，也不产生分数：本评测 scored_by=author，
// 提交侧 score 恒为 null，由作者复核证据后回填。
//
// 用法：node pack-to-result.mjs <run-dir> --out <result.json> [--model-id <dated-id>]
//   <run-dir>   CEO-Bench 运行目录（含 config.json、checkpoint.json、logs/）
//   --model-id  覆盖派生的模型 ID；缺省为 `${config.model 小写}-${运行日期}`。
//               注意：CEO-Bench config 里的上游 API 模型名可能不带日期
//               （如 MiniMax-M3 / glm-5.2），此时日期后缀是本地运行日期，
//               不是官方模型快照日期——detail 字段会如实声明这一点。

import { readFileSync, readdirSync, writeFileSync, renameSync } from "node:fs";
import { join, dirname, basename } from "node:path";

const HEADER = /=== Week \d+ Dashboard \(Day (\d+)\) ===/g;
const CASH = /Cash: \$(-?[\d,]+)/;
const SUBS = /Individual Subscribers: ([\d,]+)/;

function fail(message) {
  console.error(`pack-to-result: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { runDir: null, out: null, modelId: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--out") {
      args.out = argv[++i];
    } else if (token === "--model-id") {
      args.modelId = argv[++i];
    } else if (args.runDir === null) {
      args.runDir = token;
    } else {
      fail(`未知参数 ${token}`);
    }
  }
  if (!args.runDir || !args.out) {
    fail("用法：node pack-to-result.mjs <run-dir> --out <result.json> [--model-id <dated-id>]");
  }
  return args;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`无法读取 ${path}：${error.message}`);
  }
}

function toInt(text) {
  return Number.parseInt(text.replaceAll(",", ""), 10);
}

function fmtCash(value) {
  const absolute = Math.abs(value).toLocaleString("en-US");
  return value < 0 ? `-$${absolute}` : `$${absolute}`;
}

// 提取规则（与平台 2026-07 展示快照的开发期提取一致，已对照快照保留表逐行核验）：
// 逐行扫描 tool_results JSONL；跳过 _reasoning 记录（避免把模型推理里引用的
// 仪表盘文本误当观测）；按仪表盘标题解析模拟日；同一模拟日仅保留首次出现的
// 观测（next-week 命令输出先于每周 _dashboard 重放，故保留前者）。
function extractDashboards(toolResultsPath) {
  const rows = new Map();
  let firstTimestamp = null;
  const lines = readFileSync(toolResultsPath, "utf8").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().length === 0) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (firstTimestamp === null && typeof record.timestamp === "string") {
      firstTimestamp = record.timestamp;
    }
    if (record.tool === "_reasoning" || typeof record.result !== "string") continue;
    for (const match of record.result.matchAll(HEADER)) {
      const day = Number.parseInt(match[1], 10);
      if (rows.has(day)) continue;
      const tail = record.result.slice(match.index + match[0].length);
      const cash = CASH.exec(tail);
      const subs = SUBS.exec(tail);
      if (!cash || !subs) continue;
      rows.set(day, { day, cash: toInt(cash[1]), subs: toInt(subs[1]), line: index + 1 });
    }
  }
  return {
    rows: [...rows.values()].sort((a, b) => a.day - b.day),
    firstTimestamp,
  };
}

function buildEvents(rows, metric) {
  const events = [];
  const seen = new Set();
  const push = (day, label) => {
    const t = `第 ${day} 天`;
    if (seen.has(t)) return;
    seen.add(t);
    events.push({ t, label });
  };
  const first = rows[0];
  const last = rows[rows.length - 1];
  const peak = rows.reduce((best, row) => (row.subs > best.subs ? row : best), rows[0]);
  if (metric === "cash") {
    push(first.day, `起始现金 ${fmtCash(first.cash)}`);
    const belowHundredK = rows.find((row) => row.cash < 100_000);
    if (belowHundredK) push(belowHundredK.day, `现金跌破 $100,000（${fmtCash(belowHundredK.cash)}）`);
  } else {
    const firstSubs = rows.find((row) => row.subs > 0);
    if (firstSubs) push(firstSubs.day, `首次出现非零订阅用户（${firstSubs.subs}）`);
    if (peak.subs > 0) push(peak.day, `保留观测中的订阅用户峰值（${peak.subs}）`);
  }
  push(
    last.day,
    last.cash < 0
      ? `破产终止（现金 ${fmtCash(last.cash)}，个人订阅用户 ${last.subs}）`
      : `运行终止（现金 ${fmtCash(last.cash)}，个人订阅用户 ${last.subs}）`,
  );
  return events;
}

const args = parseArgs(process.argv.slice(2));
const config = readJson(join(args.runDir, "config.json"));
const checkpoint = readJson(join(args.runDir, "checkpoint.json"));

const logsDir = join(args.runDir, "logs");
const toolResultsName = readdirSync(logsDir).find(
  (name) => name.startsWith("tool_results_") && name.endsWith(".jsonl"),
);
if (!toolResultsName) fail(`在 ${logsDir} 找不到 tool_results_*.jsonl`);

const { rows, firstTimestamp } = extractDashboards(join(logsDir, toolResultsName));
if (rows.length === 0) fail("未提取到任何仪表盘观测");
if (!firstTimestamp) fail("tool_results 日志缺少 timestamp");

const runDate = firstTimestamp.slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) fail(`无法从 ${firstTimestamp} 解析运行日期`);

const modelId = args.modelId ?? `${String(config.model).toLowerCase()}-${runDate}`;
const last = rows[rows.length - 1];
const inputTokens = checkpoint.total_input_tokens;
const outputTokens = checkpoint.total_output_tokens;
const reasoningTokens = checkpoint.total_reasoning_tokens;

const provenanceNote =
  "以下时间线由运行日志保留的每周仪表盘观测重建，非原始工具日志的逐字摘录。";

const result = {
  eval_id: "ceo-bench",
  submission: {
    runner_version: "ceo-bench/pack-to-result@1.0.0",
    run_date: runDate,
  },
  results: [
    {
      participant: {
        model: modelId,
        config: {
          upstream_model_id: config.model,
          provider: config.provider,
          reasoning_effort: config.reasoning_effort,
          agent_type: config.agent_type,
          seed: config.seed,
          scenario: config.scenario,
          total_days: config.total_days,
          run_id: config.run_id,
          label: config.label,
        },
      },
      score: null,
      raw_metric: {
        label: "存活天数",
        value: `${last.day} 天 · 终局现金 ${fmtCash(last.cash)} · 个人订阅用户 ${last.subs}`,
      },
      detail:
        `由 CEO-Bench 本地运行 run_${config.run_id}（${runDate}，seed ${config.seed}，` +
        `${config.scenario} 场景，配置 ${config.total_days} 天）的保留观测重建归档，非平台实时跑分。` +
        `上游 API 模型名为 ${config.model}（不带日期），模型 ID 日期后缀 ${runDate} 是本地运行日期，` +
        `不是官方模型快照日期。单次运行，不代表统计稳定结论。` +
        `每周仪表盘观测 ${rows.length} 条，终止于第 ${last.day} 天。` +
        `token 用量（checkpoint）：输入 ${inputTokens.toLocaleString("en-US")}、` +
        `输出 ${outputTokens.toLocaleString("en-US")}、推理 ${reasoningTokens.toLocaleString("en-US")}；` +
        `usage.tokens 为输入+输出合计。score 为 null：scored_by=author，等待作者按公示口径回填。`,
      usage: { tokens: inputTokens + outputTokens },
      task_results: [
        {
          task_id: "novamind-default-seed42",
          score: last.day,
          raw:
            `观测存活天数 ${last.day} 天（原始观测，非作者最终评分）；` +
            `终局现金 ${fmtCash(last.cash)}，个人订阅用户 ${last.subs}；` +
            `来源 ${toolResultsName} 第 ${last.line} 行。`,
        },
      ],
      showcases: [
        {
          type: "timeline",
          title: `每周现金轨迹（重建自 run_${config.run_id} 保留仪表盘观测，非逐字日志）`,
          series: rows.map((row) => ({ t: `第 ${row.day} 天`, v: row.cash })),
          events: buildEvents(rows, "cash"),
        },
        {
          type: "timeline",
          title: `每周个人订阅用户轨迹（重建自 run_${config.run_id} 保留仪表盘观测）`,
          series: rows.map((row) => ({ t: `第 ${row.day} 天`, v: row.subs })),
          events: buildEvents(rows, "subscribers"),
        },
        {
          type: "transcript",
          title: "每周仪表盘重建时间线（样例摘录 · 非原始日志逐字引用）",
          turns: [
            { role: "system", content: provenanceNote },
            ...rows.map((row) => ({
              role: "dashboard",
              content: `第 ${row.day} 天 现金 ${fmtCash(row.cash)} 个人订阅用户 ${row.subs}`,
            })),
          ],
        },
      ],
    },
  ],
};

const target = args.out;
const temp = join(dirname(target) || ".", `.${basename(target)}.tmp`);
writeFileSync(temp, `${JSON.stringify(result, null, 2)}\n`);
renameSync(temp, target);
console.log(
  `pack-to-result: ${modelId} · ${rows.length} 条仪表盘观测 · 终止第 ${last.day} 天 → ${target}`,
);
