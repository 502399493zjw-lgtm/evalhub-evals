#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  buildModelIndex,
  loadModelRegistry,
  resolveModel,
} from "../../scripts/model-contract.mjs";

const EXPECTED_COMMIT = "fc0055dc4e0a316c3f83133267fbd6faaa770992";
const EXPECTED_TASKS_SEMANTIC_SHA256 = "5fbf5456eed791192e5a4c702a0ba2f406556e77c067ad558ff73e5d38b87efd";
const EXPECTED_POLICY_SHA256 = "3417396339ae43679fe2797588f7b5700144ca0d968e4faef1de85dd8049065a";
const TASK_IDS = ["task_001","task_002","task_003","task_004","task_005","task_006","task_007","task_008","task_010","task_012","task_014","task_015","task_016","task_017","task_018","task_019","task_020","task_021","task_022","task_023","task_024","task_025","task_026","task_027","task_028","task_029","task_031","task_032","task_033","task_034","task_035","task_036","task_037","task_038","task_039","task_040","task_041","task_043","task_044","task_045","task_046","task_047","task_048","task_049","task_050","task_051","task_052","task_053","task_054","task_055","task_056","task_057","task_058","task_059","task_060","task_061","task_062","task_063","task_064","task_065","task_066","task_067","task_068","task_069","task_070","task_071","task_072","task_073","task_074","task_075","task_076","task_077","task_078","task_079","task_080","task_081","task_082","task_083","task_084","task_085","task_086","task_087","task_088","task_089","task_090","task_091","task_092","task_093","task_094","task_095","task_096","task_097","task_098","task_099","task_100","task_101","task_102"];
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const TERMINATION_REASONS = new Set([
  "user_stop",
  "agent_stop",
  "max_steps",
  "timeout",
  "too_many_errors",
  "agent_error",
  "user_error",
  "infrastructure_error",
  "context_window_exceeded",
  "unexpected_error",
]);

function fail(message) {
  console.error(`tau3-banking packer: ${message}`);
  process.exit(1);
}

function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${name} must be an object`);
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function withoutNulls(value) {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined)
        .map(([key, item]) => [key, withoutNulls(item)]),
    );
  }
  return value;
}

function requireText(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${name} must be a non-empty string`);
  }
  return value;
}

function requireIdentifier(value, name) {
  requireText(value, name);
  if (CONTROL_CHARACTERS.test(value)) fail(`${name} must not contain control characters`);
  return value;
}

function requireTimestamp(value, name) {
  requireIdentifier(value, name);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail(`${name} must be an ISO-compatible timestamp`);
  return parsed;
}

function normalizedModelLeaf(value) {
  const leaf = String(value ?? "").split("/").at(-1);
  return leaf.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const [inputArg, outFlag, outputArg, ...unexpected] = process.argv.slice(2);
if (!inputArg || outFlag !== "--out" || !outputArg || unexpected.length > 0) {
  fail("usage: node evals/tau3-banking/pack-to-result.mjs <upstream-results.json> --out <evalhub-result.json>");
}
if (path.resolve(inputArg) === path.resolve(outputArg)) fail("input and output paths must differ");

let inputBytes;
let input;
try {
  inputBytes = fs.readFileSync(inputArg);
  input = JSON.parse(inputBytes.toString("utf8"));
} catch (error) {
  fail(`cannot read upstream results JSON: ${error.message}`);
}

object(input, "results");
const info = object(input.info, "results.info");
if (info.git_commit !== EXPECTED_COMMIT) fail(`results.info.git_commit must equal ${EXPECTED_COMMIT}`);
if (info.num_trials !== 5) fail("results.info.num_trials must equal 5");
if (info.max_steps !== 200) fail("results.info.max_steps must equal 200");
if (info.max_errors !== 10) fail("results.info.max_errors must equal the v1.0.1 default 10");
const environmentInfo = object(info.environment_info, "results.info.environment_info");
if (environmentInfo.domain_name !== "banking_knowledge") {
  fail("results.info.environment_info.domain_name must equal banking_knowledge");
}
const policy = requireText(environmentInfo.policy, "results.info.environment_info.policy");
if (sha256(policy) !== EXPECTED_POLICY_SHA256) {
  fail("results.info.environment_info.policy does not match the pinned bm25_grep policy");
}
if (info.retrieval_config !== "bm25_grep") fail("results.info.retrieval_config must equal bm25_grep");
if (info.retrieval_config_kwargs !== null &&
    (typeof info.retrieval_config_kwargs !== "object" ||
      Array.isArray(info.retrieval_config_kwargs) ||
      Object.keys(info.retrieval_config_kwargs).length !== 0)) {
  fail("results.info.retrieval_config_kwargs must be null or an empty object");
}

const userInfo = object(info.user_info, "results.info.user_info");
if (userInfo.implementation !== "user_simulator") {
  fail("results.info.user_info.implementation must equal user_simulator");
}
if (normalizedModelLeaf(userInfo.llm) !== "gpt54mini") {
  fail("results.info.user_info.llm must identify GPT-5.4 Mini");
}
if (object(userInfo.llm_args, "results.info.user_info.llm_args").reasoning_effort !== "medium") {
  fail("results.info.user_info.llm_args.reasoning_effort must equal medium");
}

const agentInfo = object(info.agent_info, "results.info.agent_info");
if (agentInfo.implementation !== "llm_agent") {
  fail("results.info.agent_info.implementation must equal llm_agent");
}
const participantModel = agentInfo.llm;
if (typeof participantModel !== "string" || participantModel.trim().length < 4 || participantModel.length > 255) {
  fail("results.info.agent_info.llm must be a 4..255 character participant model identity");
}
if (participantModel !== participantModel.trim() || CONTROL_CHARACTERS.test(participantModel)) {
  fail("results.info.agent_info.llm must be trimmed and contain no control characters");
}
const agentLlmArgs = object(agentInfo.llm_args, "results.info.agent_info.llm_args");
const modelIndex = buildModelIndex(await loadModelRegistry());
const participantResolution = resolveModel(participantModel, modelIndex);
if (participantResolution.status !== "mapped") {
  fail(`results.info.agent_info.llm is not uniquely resolvable in the EvalHub model registry (${participantResolution.reason})`);
}
const canonicalParticipantModel = participantResolution.canonicalModelId;

if (!Array.isArray(input.tasks) || input.tasks.length !== TASK_IDS.length) {
  fail("results.tasks must contain the complete pinned 97-task set");
}
const taskProjection = [];
for (const [index, taskValue] of input.tasks.entries()) {
  const task = object(taskValue, `results.tasks[${index}]`);
  if (task.id !== TASK_IDS[index]) {
    fail(`results.tasks[${index}].id must equal ${TASK_IDS[index]}`);
  }
  const userScenario = object(task.user_scenario, `results.tasks[${index}].user_scenario`);
  requireText(userScenario.instructions, `results.tasks[${index}].user_scenario.instructions`);
  object(task.evaluation_criteria, `results.tasks[${index}].evaluation_criteria`);
  taskProjection.push(withoutNulls({
    id: task.id,
    user_scenario: task.user_scenario,
    initial_state: task.initial_state,
    evaluation_criteria: task.evaluation_criteria,
    required_documents: task.required_documents,
    user_tools: task.user_tools,
  }));
}
if (sha256(stableJson(taskProjection)) !== EXPECTED_TASKS_SEMANTIC_SHA256) {
  fail("results.tasks content does not match the pinned v1.0.1 banking_knowledge tasks");
}

if (!Array.isArray(input.simulations) || input.simulations.length !== TASK_IDS.length * 5) {
  fail("results.simulations must contain exactly 485 rows");
}

const allowedTasks = new Set(TASK_IDS);
const seen = new Set();
const seenSimulationIds = new Set();
const manifestRows = [];
const taskResults = [];
let successes = 0;

for (const [index, simulationValue] of input.simulations.entries()) {
  const simulation = object(simulationValue, `results.simulations[${index}]`);
  const simulationId = requireIdentifier(simulation.id, `results.simulations[${index}].id`);
  if (seenSimulationIds.has(simulationId)) fail(`duplicate simulation id ${simulationId}`);
  seenSimulationIds.add(simulationId);
  if (!allowedTasks.has(simulation.task_id)) fail(`results.simulations[${index}].task_id is not in the pinned 97-task set`);
  if (!Number.isInteger(simulation.trial) || simulation.trial < 0 || simulation.trial > 4) {
    fail(`results.simulations[${index}].trial must be the upstream 0..4 value`);
  }
  if (simulation.mode !== "half_duplex") {
    fail(`results.simulations[${index}].mode must equal half_duplex`);
  }
  const timestampMs = requireTimestamp(simulation.timestamp, `results.simulations[${index}].timestamp`);
  const startMs = requireTimestamp(simulation.start_time, `results.simulations[${index}].start_time`);
  const endMs = requireTimestamp(simulation.end_time, `results.simulations[${index}].end_time`);
  if (endMs < startMs || timestampMs > endMs) {
    fail(`results.simulations[${index}] has inconsistent timestamps`);
  }
  if (!Number.isFinite(simulation.duration) || simulation.duration < 0) {
    fail(`results.simulations[${index}].duration must be a non-negative finite number`);
  }
  if (!TERMINATION_REASONS.has(simulation.termination_reason)) {
    fail(`results.simulations[${index}].termination_reason is invalid`);
  }
  if (!Array.isArray(simulation.messages)) {
    fail(`results.simulations[${index}].messages must be an array for half_duplex results`);
  }
  const rewardInfo = object(simulation.reward_info, `results.simulations[${index}].reward_info`);
  const reward = rewardInfo.reward;
  if (reward !== 0 && reward !== 1) fail(`results.simulations[${index}].reward_info.reward must be binary 0 or 1`);

  const identity = `${simulation.task_id}#${simulation.trial}`;
  if (seen.has(identity)) fail(`duplicate simulation ${identity}`);
  seen.add(identity);

  const simulationSha256 = sha256(stableJson(simulation));
  manifestRows.push(`${identity}  ${simulationSha256}`);
  successes += reward;
  taskResults.push({
    task_id: simulation.task_id.replaceAll("_", "-"),
    score: reward * 100,
    raw: `trial=${simulation.trial + 1} reward=${reward} canonical_simulation_sha256=${simulationSha256}`,
  });
}

for (const taskId of TASK_IDS) {
  for (let trial = 0; trial < 5; trial += 1) {
    if (!seen.has(`${taskId}#${trial}`)) fail(`missing simulation ${taskId}#${trial}`);
  }
}

manifestRows.sort();
taskResults.sort((left, right) => left.task_id.localeCompare(right.task_id) || left.raw.localeCompare(right.raw));
const evidenceSha256 = sha256(`${manifestRows.join("\n")}\n`);
const sourceResultsSha256 = sha256(inputBytes);
const score = (successes / (TASK_IDS.length * 5)) * 100;
const timestamp = typeof input.timestamp === "string" ? input.timestamp : "";
if (!/^\d{4}-\d{2}-\d{2}/.test(timestamp)) fail("results.timestamp must begin with YYYY-MM-DD");
const runDate = timestamp.slice(0, 10);

const output = {
  eval_id: "tau3-banking",
  submission: {
    kind: "run",
    runner_version: "tau3-banking-packager@1.2.0",
    run_date: runDate,
  },
  results: [{
    participant: {
      model: canonicalParticipantModel,
      harness: "tau2-bench",
      harness_version: "v1.0.1",
      config: { agent_llm_args: agentLlmArgs },
    },
    score,
    raw_metric: { label: "97×5 binary pass mean", value: `${successes}/485` },
    detail: `source_results_sha256=${sourceResultsSha256}; evidence_sha256=${evidenceSha256}; upstream_commit=${EXPECTED_COMMIT}; retrieval_config=bm25_grep; user_simulator=${userInfo.llm} medium; max_steps=200; attempts=485.`,
    task_results: taskResults,
  }],
};

try {
  fs.writeFileSync(outputArg, `${JSON.stringify(output, null, 2)}\n`, { flag: "wx" });
} catch (error) {
  fail(`cannot write ${outputArg}: ${error.message}`);
}
console.log(`wrote ${outputArg}: score=${score} (${successes}/485)`);
