/**
 * gamecraft-bench 外部流程转换器（external_workflow）。
 *
 * 用法：
 *   node evals/gamecraft-bench/pack-to-result.mjs <submission.json> --out <result.json>
 *
 * 真实输入是参赛方在自己的基础设施上跑完官方验分器之后汇总出的提交清单：140 道题各一条记录，
 * 每条给出该题官方验分器写出的 reward（reward.txt 里的 [0,1] 浮点数）、BUILD 闸门结果、
 * 实际被判分的 demo 数，以及该题验分产物目录的 sha256 指纹。随仓库提供的
 * `synthetic_fixture: true` 清单仅用于演示结构，绝不是一次实际运行。
 *
 * 转换器只做确定性校验与算术：不联网、不调用任何模型、不读环境变量、不读输入文件与本目录
 * eval.yaml 以外的任何路径。强制的协议边界：
 *   - 题目集合必须与 eval.yaml 的 140 个稳定任务 ID 完全一致，不多、不少、不重复；
 *   - 每题 reward 必须落在 [0,1]，与官方验分器 reward.txt 的值域一致；
 *   - build_ok=false 的题目 reward 必须恰为 0（上游 score.py 在闸门失败时短路，必然为 0）；
 *   - scored_demos 必须在 0–10 之间（上游 140 份 rubric 全部 max_demos=10）；为 0 时 reward 必须为 0；
 *   - 裁判必须是上游默认的 openai / gpt-5.5，换裁判即改变可比性；
 *   - 总分 = 140 题 reward 的等权平均 × 100，与上游榜单口径一致，保留两位小数；
 *   - 任一条不合法即整体转换失败，绝不写出半成品，也不用 null 充数。
 *
 * 结果信封先用共享 schema 与本评测契约二次校验，再原子替换目标文件。
 */

import { createHash } from "node:crypto";
import {
  readFileSync,
  renameSync,
  rmSync,
  statSync,
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

const EVAL_ID = "gamecraft-bench";
const RUNNER_VERSION = "gamecraft-bench/pack-to-result@1.1.0";
const PROTOCOL_REVISION = 1;
const UPSTREAM_COMMIT = "7385d326fb25ba9af8b353615987bf680a25b657";
const JUDGE_BACKEND = "openai";
const JUDGE_MODEL = "gpt-5.5";
const BUILD_CHECK_CMD = "godot --headless --path /workspace/game --quit-after 5";
const TASK_COUNT = 140;
const MAX_DEMOS = 10;
const MANIFEST_MAX_BYTES = 4 * 1024 * 1024;

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9._-]{3,128}$/u;
// participant.model 直接进入平台的模型识别，共享 schema 只允许 ASCII 字母数字与
// ._/:+-（不含空格），因此这里用同一套字符集，避免把非法身份带到 schema 才报错。
const MODEL_ID_PATTERN = /^[A-Za-z0-9._/:+-]{2,255}$/u;
// 参赛者身份会被公开展示并进入平台的模型识别，因此除控制字符外还要挡掉双向覆盖符与
// 零宽字符（避免展示出的名字与实际字符串不一致），并拒绝首尾空白。
const INVISIBLE_OR_BIDI = /[\u200b-\u200f\u2028\u2029\u202a-\u202e\u2060-\u2069\ufeff]/u;
const IDENTITY_TEXT_PATTERN = /^\S(?:.*\S)?$/u;
const IDENTITY_MAX_LENGTH = 255;
const CONTROL_CHARS = /[\x00-\x1f\x7f-\x9f]/u;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const MANIFEST_KEYS = Object.freeze([
  "manifest_version",
  "synthetic_fixture",
  "eval_id",
  "protocol_revision",
  "upstream_commit",
  "judge",
  "participant",
  "run_date",
  "tasks",
]);
const PARTICIPANT_KEYS = Object.freeze(["model", "harness", "harness_version"]);
const JUDGE_KEYS = Object.freeze(["backend", "model"]);
const TASK_KEYS = Object.freeze([
  "task_id",
  "run_id",
  "build_ok",
  "reward",
  "scored_demos",
  "evidence_sha256",
]);

const FAMILY_LABELS = Object.freeze({
  platformer: "Platformer",
  strategy: "Strategy",
  tycoon: "Tycoon",
  openworld: "Open-world",
  roguelike: "Roguelike",
  visualnovel: "Visual novel",
  puzzle: "Puzzle",
  shooter: "Shooter",
  simulation: "Simulation",
  cardgame: "Card game",
  horror: "Horror",
  rhythm: "Rhythm",
  idle: "Idle",
  racing: "Racing",
  sports: "Sports",
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

/** 公开展示的身份字段：拒绝控制字符、双向覆盖符、零宽字符与首尾空白。 */
function requireIdentityText(value, label) {
  if (typeof value !== "string" || value.length > IDENTITY_MAX_LENGTH) {
    fail(`${label} 缺失或超过 ${IDENTITY_MAX_LENGTH} 字符`);
  }
  if (CONTROL_CHARS.test(value)) {
    fail(`${label} 不能包含控制字符`);
  }
  if (INVISIBLE_OR_BIDI.test(value)) {
    fail(`${label} 不能包含零宽字符或双向覆盖符，否则展示出的身份与实际字符串不一致`);
  }
  if (!IDENTITY_TEXT_PATTERN.test(value)) {
    fail(`${label} 不能为空，也不能以空白开头或结尾`);
  }
  return value;
}

function requireInteger(value, min, max, label) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    fail(`${label} 必须是 ${min} 到 ${max} 之间的整数`);
  }
  return value;
}

function requireReward(value, label) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    fail(`${label} 必须是 0 到 1 之间的有限数值（官方验分器 reward.txt 的值域）`);
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

function roundSix(value) {
  return Number(value.toFixed(6));
}

function roundTwo(value) {
  return Number(value.toFixed(2));
}

function parseArgv(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") {
    fail(
      "用法：node evals/gamecraft-bench/pack-to-result.mjs <submission.json> --out <result.json>",
    );
  }
  const [input, , output] = argv;
  if (typeof input !== "string" || input.length === 0) {
    fail("缺少提交清单路径");
  }
  if (typeof output !== "string" || !output.endsWith(".json")) {
    fail("输出路径必须以 .json 结尾");
  }
  return { input: resolve(input), output: resolve(output) };
}

/**
 * JSON.parse 对重复键是「后者胜」，于是同一份清单可以让人读到 reward=0.09、
 * 让转换器算成 reward=1。scored_by=author 依赖人工核对这份文件，所以这种
 * 「肉眼所见 ≠ 实际取值」必须直接拒绝，而不是静默取后者。
 *
 * JSON.parse 的 reviver 看不到被覆盖掉的那一份，所以只能在词法层面查：扫一遍源码，
 * 逐个对象跟踪已出现过的键名。这里只需要识别字符串与结构字符，不必真正建树。
 */
function assertNoDuplicateJsonKeys(source) {
  const stack = [];
  let index = 0;
  let expectKey = false;

  function readString() {
    // 进入时 source[index] === '"'
    let out = "";
    index += 1;
    while (index < source.length) {
      const ch = source[index];
      if (ch === "\\") {
        out += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (ch === '"') {
        index += 1;
        return out;
      }
      out += ch;
      index += 1;
    }
    fail("提交清单不是合法 JSON：字符串未闭合");
  }

  while (index < source.length) {
    const ch = source[index];
    if (ch === '"') {
      const raw = readString();
      if (expectKey && stack.length > 0) {
        const keys = stack[stack.length - 1];
        if (keys !== null) {
          if (keys.has(raw)) {
            fail(
              `提交清单含重复的 JSON 键 ${JSON.stringify(raw)}；重复键会让人工核对看到的值与实际取值不一致`,
            );
          }
          keys.add(raw);
        }
        expectKey = false;
      }
      continue;
    }
    if (ch === "{") {
      stack.push(new Set());
      expectKey = true;
    } else if (ch === "[") {
      stack.push(null);
      expectKey = false;
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      expectKey = false;
    } else if (ch === ",") {
      expectKey = stack.length > 0 && stack[stack.length - 1] !== null;
    } else if (ch === ":") {
      expectKey = false;
    }
    index += 1;
  }
}

function readManifest(inputPath) {
  let stats;
  try {
    stats = statSync(inputPath);
  } catch (error) {
    fail(`无法读取提交清单：${error.message}`);
  }
  if (!stats.isFile()) {
    fail("提交清单必须是普通文件");
  }
  if (stats.size > MANIFEST_MAX_BYTES) {
    fail(`提交清单超过 ${MANIFEST_MAX_BYTES} 字节上限`);
  }
  let source;
  try {
    source = readFileSync(inputPath, "utf8");
  } catch (error) {
    fail(`无法读取提交清单：${error.message}`);
  }
  assertNoDuplicateJsonKeys(source);
  try {
    return {
      manifest: JSON.parse(source),
      digest: createHash("sha256").update(source).digest("hex"),
    };
  } catch (error) {
    fail(`提交清单不是合法 JSON：${error.message}`);
  }
}

function loadEvalDefinition() {
  const yamlPath = resolve(dirname(fileURLToPath(import.meta.url)), "eval.yaml");
  let source;
  try {
    source = readFileSync(yamlPath, "utf8");
  } catch (error) {
    fail(`无法读取 eval.yaml：${error.message}`);
  }
  const parsed = EvalDefSchema.safeParse(parseYaml(source));
  if (!parsed.success) {
    fail(
      `eval.yaml 不合法：${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const definition = parsed.data;
  // 转换器内置的协议常量必须与同目录 eval.yaml 一致，否则「清单按 eval.yaml 校验」
  // 这句承诺就是空的：改了 eval.yaml 而忘了改这里会静默按旧协议判分。
  if (definition.id !== EVAL_ID) {
    fail(`eval.yaml 的 id 是 ${definition.id}，与转换器内置的 ${EVAL_ID} 不一致`);
  }
  if (definition.protocol_revision !== PROTOCOL_REVISION) {
    fail(
      `eval.yaml 的 protocol_revision 是 ${definition.protocol_revision}，与转换器内置的 ${PROTOCOL_REVISION} 不一致`,
    );
  }
  if (definition.upstream?.commit !== UPSTREAM_COMMIT) {
    fail("eval.yaml 的 upstream.commit 与转换器内置的来源 commit 不一致");
  }
  if (definition.trials !== 1) {
    fail(`eval.yaml 的 trials 是 ${definition.trials}；本转换器每题只写一条结果`);
  }
  return definition;
}

function validateJudge(raw) {
  const judge = plainObject(raw, "judge");
  onlyKnownKeys(judge, JUDGE_KEYS, "judge");
  if (judge.backend !== JUDGE_BACKEND || judge.model !== JUDGE_MODEL) {
    fail(
      `judge 必须是上游默认的 ${JUDGE_BACKEND} / ${JUDGE_MODEL}；换裁判后端或模型会改变可比性，不能与本榜现有成绩同列`,
    );
  }
  return { backend: judge.backend, model: judge.model };
}

function validateParticipant(raw) {
  const participant = plainObject(raw, "participant");
  onlyKnownKeys(participant, PARTICIPANT_KEYS, "participant");
  const model = requireString(
    participant.model,
    MODEL_ID_PATTERN,
    "participant.model",
  );
  const harness = requireIdentityText(participant.harness, "participant.harness");
  // agent 参赛者的 harness 与 harness_version 是共享 schema 里的成对字段：
  // 填了 harness 就必须给 harness_version，否则结果信封会在最终校验时被拒。
  const harnessVersion = requireIdentityText(
    participant.harness_version,
    "participant.harness_version",
  );
  return { model, harness, harness_version: harnessVersion };
}

function validateTask(raw, index, knownTaskIds) {
  const task = plainObject(raw, `tasks[${index}]`);
  onlyKnownKeys(task, TASK_KEYS, `tasks[${index}]`);
  const taskId = task.task_id;
  if (typeof taskId !== "string" || !knownTaskIds.has(taskId)) {
    fail(
      `tasks[${index}].task_id ${JSON.stringify(taskId)} 不是 eval.yaml 声明的任务 ID`,
    );
  }
  requireString(task.run_id, RUN_ID_PATTERN, `tasks[${index}].run_id`);
  requireString(
    task.evidence_sha256,
    SHA256_PATTERN,
    `tasks[${index}].evidence_sha256`,
  );
  if (typeof task.build_ok !== "boolean") {
    fail(
      `tasks[${index}].build_ok 必须是布尔值，对应闸门命令 \`${BUILD_CHECK_CMD}\` 的退出码是否为 0`,
    );
  }
  const reward = requireReward(task.reward, `tasks[${index}].reward`);
  const scoredDemos = requireInteger(
    task.scored_demos,
    0,
    MAX_DEMOS,
    `tasks[${index}].scored_demos`,
  );
  if (!task.build_ok && reward !== 0) {
    fail(
      `tasks[${index}]（${taskId}）：build_ok=false 时上游验分器跳过回放与判分，reward 必然为 0，提交值为 ${reward}`,
    );
  }
  if (!task.build_ok && scoredDemos !== 0) {
    fail(
      `tasks[${index}]（${taskId}）：build_ok=false 时验分器根本不回放 demo，scored_demos 必然为 0，提交值为 ${scoredDemos}`,
    );
  }
  if (scoredDemos === 0 && reward !== 0) {
    fail(
      `tasks[${index}]（${taskId}）：没有 demo 被判分时全部 requirement 记 0，reward 必然为 0，提交值为 ${reward}`,
    );
  }
  return {
    taskId,
    runId: task.run_id,
    evidenceSha256: task.evidence_sha256,
    buildOk: task.build_ok,
    reward,
    scoredDemos,
  };
}

function validateManifest(raw, definition) {
  const manifest = plainObject(raw, "提交清单");
  onlyKnownKeys(manifest, MANIFEST_KEYS, "提交清单");
  if (manifest.manifest_version !== 1) {
    fail("manifest_version 目前只支持 1");
  }
  if (manifest.eval_id !== EVAL_ID) {
    fail(`eval_id 必须是 ${EVAL_ID}`);
  }
  if (manifest.protocol_revision !== PROTOCOL_REVISION) {
    fail(`protocol_revision 必须是 ${PROTOCOL_REVISION}`);
  }
  if (manifest.upstream_commit !== UPSTREAM_COMMIT) {
    fail("upstream_commit 必须是本评测钉死的来源 commit");
  }
  const judge = validateJudge(manifest.judge);
  const participant = validateParticipant(manifest.participant);
  if (
    manifest.synthetic_fixture !== undefined &&
    manifest.synthetic_fixture !== true
  ) {
    fail("synthetic_fixture 如出现只能为 true；真实提交必须省略该字段");
  }
  const syntheticFixture = manifest.synthetic_fixture === true;
  if (syntheticFixture && !participant.model.startsWith("example/")) {
    fail("synthetic_fixture 只能使用 example/ 前缀的夹具 participant.model");
  }
  const runDate = requireString(
    manifest.run_date,
    CALENDAR_DATE_PATTERN,
    "run_date",
  );
  if (!isRealCalendarDate(runDate)) {
    fail("run_date 必须是真实存在的日期");
  }

  const knownTaskIds = new Set(definition.tasks.map((task) => task.id));
  if (knownTaskIds.size !== TASK_COUNT) {
    fail(`eval.yaml 应声明 ${TASK_COUNT} 个任务，实际为 ${knownTaskIds.size}`);
  }
  if (!Array.isArray(manifest.tasks) || manifest.tasks.length !== TASK_COUNT) {
    fail(`tasks 必须是长度为 ${TASK_COUNT} 的数组，140 道题各一条记录`);
  }

  const byTaskId = new Map();
  const seenRunIds = new Set();
  const seenEvidence = new Set();
  for (const [index, entry] of manifest.tasks.entries()) {
    const task = validateTask(entry, index, knownTaskIds);
    if (byTaskId.has(task.taskId)) {
      fail(`tasks：任务 ${task.taskId} 重复提交`);
    }
    // 不同题目是不同的验分运行，产物目录也不同，因此 run_id 与证据指纹必须各不相同。
    // 复用同一个值说明清单是拼凑的，无法据此回溯到逐题产物。
    if (seenRunIds.has(task.runId)) {
      fail(`tasks：run_id ${JSON.stringify(task.runId)} 在多道题上重复，无法回溯到各自的验分产物`);
    }
    if (seenEvidence.has(task.evidenceSha256)) {
      fail(
        `tasks：evidence_sha256 ${task.evidenceSha256.slice(0, 12)}… 在多道题上重复；不同题目的验分产物不可能同摘要`,
      );
    }
    seenRunIds.add(task.runId);
    seenEvidence.add(task.evidenceSha256);
    byTaskId.set(task.taskId, task);
  }
  const missing = [...knownTaskIds].filter((id) => !byTaskId.has(id));
  if (missing.length > 0) {
    fail(
      `tasks 缺少 ${missing.length} 道题：${missing.slice(0, 5).join("、")}${missing.length > 5 ? " 等" : ""}`,
    );
  }

  return {
    judge,
    participant,
    runDate,
    syntheticFixture,
    tasks: definition.tasks.map((task) => byTaskId.get(task.id)),
  };
}

/**
 * 总分 = 140 题 reward 的等权平均 × 100，保留两位小数。
 *
 * 逐个累加浮点会让 .xx5 边界上的四舍五入不稳定，所以先把每个 reward 按其十进制字面
 * 精度放大成整数再求和，最后一次性做除法与舍入。上游 reward.txt 是 6 位小数，
 * 这里按最多 12 位小数处理，足以覆盖任何合法输入且不引入新的精度误差。
 */
const REWARD_SCALE = 1_000_000_000_000;

function scoreTasks(tasks) {
  let scaledSum = 0;
  for (const task of tasks) {
    const scaled = Math.round(task.reward * REWARD_SCALE);
    if (!Number.isSafeInteger(scaled)) {
      fail(`任务 ${task.taskId} 的 reward 精度超出可安全表示的范围`);
    }
    scaledSum += scaled;
    if (!Number.isSafeInteger(scaledSum)) {
      fail("reward 累加超出可安全表示的范围");
    }
  }
  const total = roundTwo((scaledSum / tasks.length / REWARD_SCALE) * 100);
  if (!Number.isFinite(total) || total < 0 || total > 100) {
    fail("总分越界，拒绝写出结果");
  }
  return total;
}

function familyOf(taskId) {
  const label = FAMILY_LABELS[taskId.split("-")[0]];
  if (label === undefined) {
    fail(`任务 ${taskId} 的前缀不属于已知游戏族`);
  }
  return label;
}

function buildFamilyRows(tasks) {
  const groups = new Map();
  for (const task of tasks) {
    const family = familyOf(task.taskId);
    const bucket = groups.get(family) ?? { n: 0, sum: 0, builds: 0 };
    bucket.n += 1;
    bucket.sum += task.reward;
    bucket.builds += task.buildOk ? 1 : 0;
    groups.set(family, bucket);
  }
  return [...groups.entries()]
    .sort(
      (left, right) =>
        right[1].n - left[1].n || left[0].localeCompare(right[0], "en"),
    )
    .map(([family, bucket]) => ({
      cells: [
        family,
        bucket.n,
        roundTwo((bucket.sum / bucket.n) * 100),
        `${bucket.builds}/${bucket.n}`,
      ],
    }));
}

function buildEnvelope({
  judge,
  participant,
  runDate,
  tasks,
  total,
  manifestDigest,
  syntheticFixture,
}) {
  const buildOkCount = tasks.filter((task) => task.buildOk).length;
  const zeroCount = tasks.filter((task) => task.reward === 0).length;
  const demoTotal = tasks.reduce((sum, task) => sum + task.scoredDemos, 0);
  return {
    eval_id: EVAL_ID,
    submission: {
      kind: "run",
      runner_version: RUNNER_VERSION,
      run_date: runDate,
    },
    results: [
      {
        participant,
        score: total,
        raw_metric: {
          label: "140 题等权平均总分",
          value: `${total.toFixed(2)} 分`,
          tiebreak_value: total,
        },
        detail: syntheticFixture
          ? [
              "这是供文档与 CI 使用的合成结构夹具，不是任何模型的成绩、官方基线或真实复跑。",
              `清单以 synthetic_fixture=true 标识；显示的 ${TASK_COUNT} 题 reward、闸门与 demo 数只用于演示转换器。`,
              `转换器未执行或审计上游验分器；示例总分 ${total.toFixed(2)} 分仅由夹具数值按等权平均 × 100 算出。`,
              `夹具清单 sha256=${manifestDigest}。`,
              "转换器仅校验题目集合、reward 值域、闸门与 reward 的一致性、demo 上限和裁判身份。",
            ].join("")
          : [
              "这是从参赛方提供的外部工作流清单打包出的结果；该清单声明已在钉死的来源 commit ",
              `${UPSTREAM_COMMIT} 上用官方验分器跑完全部 ${TASK_COUNT} 道题，裁判为上游默认的 ${judge.backend} / ${judge.model}。`,
              "转换器未执行或审计上游验分器；成绩仍须由评测作者核对逐题验分产物后才认可。",
              "总分 = 清单所报各题 reward（官方 reward.txt 的 [0,1] 值）等权平均 × 100，与上游榜单口径一致并保留两位小数。",
              `清单所报启动闸门 \`${BUILD_CHECK_CMD}\` 通过 ${buildOkCount}/${TASK_COUNT} 题，`,
              `${zeroCount} 题记 0 分，累计被判分的 demo 共 ${demoTotal} 个。`,
              `提交清单 sha256=${manifestDigest}。`,
              "转换器强制校验题目集合、reward 值域、闸门与 reward 的一致性、demo 上限和裁判身份，不接受提交方覆盖。",
            ].join(""),
        ...(syntheticFixture
          ? {}
          : {
              task_results: tasks.map((task) => ({
                task_id: task.taskId,
                score: roundSix(task.reward),
                raw: `reward=${task.reward} · BUILD=${task.buildOk ? 1 : 0} · demos=${task.scoredDemos} · ${task.runId}`,
              })),
            }),
        supplementary_views: [
          {
            type: "metric_table",
            id: "run-family-breakdown",
            label: "清单分家族",
            title: "按清单汇总的分家族成绩",
            columns: ["游戏族", "题数", "平均分", "启动闸门通过"],
            rows: buildFamilyRows(tasks),
            note: "各族平均分 = 该族题目 reward 的等权平均 × 100，由转换器按提交的逐题 reward 确定性算出，仅解释主分数，不参与排名。",
          },
          {
            type: "metric_table",
            id: "run-gate-summary",
            label: "清单闸门与取证",
            title: "按清单汇总的闸门与取证摘要",
            columns: ["项目", "数值"],
            rows: [
              { cells: ["题目总数", TASK_COUNT] },
              { cells: ["启动闸门通过题数", buildOkCount] },
              { cells: ["记 0 分题数", zeroCount] },
              { cells: ["被判分的 demo 总数", demoTotal] },
              {
                cells: ["裁判后端 / 模型", `${judge.backend} / ${judge.model}`],
              },
            ],
            note: `闸门命令为 \`${BUILD_CHECK_CMD}\`，失败即该题记 0 分；单题至多 ${MAX_DEMOS} 个 demo 参与判分。辅助展示，不参与排名。`,
          },
        ],
      },
    ],
  };
}

/**
 * 原子写出：先写同目录下的临时文件再 rename。
 * 用 wx 独占创建，避免跟随预先放好的同名符号链接；失败时清掉临时文件，不留残渣。
 */
function writeAtomic(outputPath, envelope) {
  const temporaryPath = resolve(
    dirname(outputPath),
    `${basename(outputPath)}.partial`,
  );
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(envelope, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
  } catch (error) {
    fail(`无法写出临时结果文件 ${temporaryPath}：${error.message}`);
  }
  try {
    renameSync(temporaryPath, outputPath);
  } catch (error) {
    try {
      rmSync(temporaryPath, { force: true });
    } catch {
      // 清理失败不掩盖真正的 rename 错误。
    }
    fail(`无法原子替换结果文件 ${outputPath}：${error.message}`);
  }
}

function main(argv) {
  const { input, output } = parseArgv(argv);
  const definition = loadEvalDefinition();
  const { manifest, digest } = readManifest(input);
  const { judge, participant, runDate, syntheticFixture, tasks } = validateManifest(
    manifest,
    definition,
  );
  const total = scoreTasks(tasks);
  const envelope = buildEnvelope({
    judge,
    participant,
    runDate,
    tasks,
    total,
    manifestDigest: digest,
    syntheticFixture,
  });
  const generic = ResultFileSchema.safeParse(envelope);
  if (!generic.success) {
    fail(
      `生成的结果不符合结果结构：${generic.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  const contextual = validateResultForEval(definition, generic.data);
  if (!contextual.success) {
    fail(
      `生成的结果不符合本评测契约：${contextual.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }
  writeAtomic(output, generic.data);
  console.log(
    `${EVAL_ID}: ${participant.harness} / ${participant.model} = ${total.toFixed(2)} 分${syntheticFixture ? "（合成夹具）" : ""}`,
  );
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`gamecraft-bench 转换失败：${error.message}`);
  process.exitCode = 1;
}
