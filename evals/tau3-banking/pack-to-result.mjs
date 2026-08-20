#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const EXPECTED_COMMIT = "fc0055dc4e0a316c3f83133267fbd6faaa770992";
const TASK_IDS = ["task_001","task_002","task_003","task_004","task_005","task_006","task_007","task_008","task_010","task_012","task_014","task_015","task_016","task_017","task_018","task_019","task_020","task_021","task_022","task_023","task_024","task_025","task_026","task_027","task_028","task_029","task_031","task_032","task_033","task_034","task_035","task_036","task_037","task_038","task_039","task_040","task_041","task_043","task_044","task_045","task_046","task_047","task_048","task_049","task_050","task_051","task_052","task_053","task_054","task_055","task_056","task_057","task_058","task_059","task_060","task_061","task_062","task_063","task_064","task_065","task_066","task_067","task_068","task_069","task_070","task_071","task_072","task_073","task_074","task_075","task_076","task_077","task_078","task_079","task_080","task_081","task_082","task_083","task_084","task_085","task_086","task_087","task_088","task_089","task_090","task_091","task_092","task_093","task_094","task_095","task_096","task_097","task_098","task_099","task_100","task_101","task_102"];
const SHA256 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(message) {
  console.error(`tau3-banking packer: ${message}`);
  process.exit(1);
}
function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${name} must be an object`);
  return value;
}
function exactKeys(value, allowed, name) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${name} contains unsupported field ${key}`);
}

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) fail("usage: node pack-to-result.mjs <input.json> <output.json>");
if (path.resolve(inputArg) === path.resolve(outputArg)) fail("input and output must differ");
let input;
try { input = JSON.parse(fs.readFileSync(inputArg, "utf8")); } catch (error) { fail(`cannot read input JSON: ${error.message}`); }
object(input, "input");
if (Object.hasOwn(input, "score") || Object.hasOwn(input, "results")) fail("input must not provide a precomputed score/results");
exactKeys(input, ["format_version", "run_id", "run_date", "evidence_sha256", "participant", "protocol", "attempts"], "input");
if (input.format_version !== 1) fail("format_version must equal 1");
if (typeof input.run_id !== "string" || input.run_id.trim() === "") fail("run_id must be non-empty");
if (typeof input.run_date !== "string" || !ISO_DATE.test(input.run_date)) fail("run_date must be YYYY-MM-DD");
if (typeof input.evidence_sha256 !== "string" || !SHA256.test(input.evidence_sha256)) fail("evidence_sha256 must be lowercase SHA-256");
if (input.evidence_sha256 === "0".repeat(64)) fail("evidence_sha256 must not be an all-zero placeholder");

const participant = object(input.participant, "participant");
exactKeys(participant, ["model", "harness", "harness_version", "config"], "participant");
for (const key of ["model", "harness", "harness_version"]) {
  if (typeof participant[key] !== "string" || participant[key].trim() === "") fail(`participant.${key} must be non-empty`);
}
if (participant.config !== undefined) object(participant.config, "participant.config");

const protocol = object(input.protocol, "protocol");
exactKeys(protocol, ["upstream_commit", "domain", "retrieval_config", "user_simulator", "user_reasoning", "max_steps", "trials"], "protocol");
const requiredProtocol = {
  upstream_commit: EXPECTED_COMMIT,
  domain: "banking_knowledge",
  retrieval_config: "bm25_grep",
  user_simulator: "GPT-5.4 Mini",
  user_reasoning: "medium",
  max_steps: 200,
  trials: 5,
};
for (const [key, expected] of Object.entries(requiredProtocol)) if (protocol[key] !== expected) fail(`protocol.${key} must equal ${JSON.stringify(expected)}`);

if (!Array.isArray(input.attempts) || input.attempts.length !== TASK_IDS.length * 5) fail("attempts must contain exactly 485 rows");
const allowedTasks = new Set(TASK_IDS);
const seen = new Set();
let successes = 0;
const taskResults = [];
for (const [index, attemptValue] of input.attempts.entries()) {
  const attempt = object(attemptValue, `attempts[${index}]`);
  exactKeys(attempt, ["task_id", "trial", "reward", "trajectory_sha256"], `attempts[${index}]`);
  if (!allowedTasks.has(attempt.task_id)) fail(`attempts[${index}].task_id is not in the pinned task set`);
  if (!Number.isInteger(attempt.trial) || attempt.trial < 1 || attempt.trial > 5) fail(`attempts[${index}].trial must be 1..5`);
  if (attempt.reward !== 0 && attempt.reward !== 1) fail(`attempts[${index}].reward must be binary 0 or 1`);
  if (typeof attempt.trajectory_sha256 !== "string" || !SHA256.test(attempt.trajectory_sha256)) fail(`attempts[${index}].trajectory_sha256 must be lowercase SHA-256`);
  if (attempt.trajectory_sha256 === "0".repeat(64)) fail(`attempts[${index}].trajectory_sha256 must not be an all-zero placeholder`);
  const identity = `${attempt.task_id}#${attempt.trial}`;
  if (seen.has(identity)) fail(`duplicate attempt ${identity}`);
  seen.add(identity);
  successes += attempt.reward;
  taskResults.push({ task_id: attempt.task_id, score: attempt.reward * 100, raw: `trial=${attempt.trial} reward=${attempt.reward} trajectory_sha256=${attempt.trajectory_sha256}` });
}
for (const taskId of TASK_IDS) for (let trial = 1; trial <= 5; trial += 1) if (!seen.has(`${taskId}#${trial}`)) fail(`missing attempt ${taskId}#${trial}`);

const score = (successes / (TASK_IDS.length * 5)) * 100;
const output = {
  eval_id: "tau3-banking",
  submission: { kind: "run", runner_version: "tau3-banking-packager@1.0.0", run_date: input.run_date },
  results: [{
    participant,
    score,
    raw_metric: { label: "97×5 binary pass mean", value: `${successes}/485` },
    detail: `run_id=${input.run_id}; evidence_sha256=${input.evidence_sha256}; upstream_commit=${EXPECTED_COMMIT}; retrieval_config=bm25_grep; user_simulator=GPT-5.4 Mini medium; max_steps=200; attempts=485.`,
    task_results: taskResults,
  }],
};
fs.writeFileSync(outputArg, JSON.stringify(output, null, 2) + "\n", { flag: "wx" });
console.log(`wrote ${outputArg}: score=${score} (${successes}/485)`);
