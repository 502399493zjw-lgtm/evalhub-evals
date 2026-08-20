#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const EXPECTED_COMMIT = "fc0055dc4e0a316c3f83133267fbd6faaa770992";
const TASK_IDS = ["task-001","task-002","task-003","task-004","task-005","task-006","task-007","task-008","task-010","task-012","task-014","task-015","task-016","task-017","task-018","task-019","task-020","task-021","task-022","task-023","task-024","task-025","task-026","task-027","task-028","task-029","task-031","task-032","task-033","task-034","task-035","task-036","task-037","task-038","task-039","task-040","task-041","task-043","task-044","task-045","task-046","task-047","task-048","task-049","task-050","task-051","task-052","task-053","task-054","task-055","task-056","task-057","task-058","task-059","task-060","task-061","task-062","task-063","task-064","task-065","task-066","task-067","task-068","task-069","task-070","task-071","task-072","task-073","task-074","task-075","task-076","task-077","task-078","task-079","task-080","task-081","task-082","task-083","task-084","task-085","task-086","task-087","task-088","task-089","task-090","task-091","task-092","task-093","task-094","task-095","task-096","task-097","task-098","task-099","task-100","task-101","task-102"];
const SHA256 = /^[0-9a-f]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const PARTICIPANT_IDENTITY_MAX_LENGTH = 255;

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
  if (participant[key].length > PARTICIPANT_IDENTITY_MAX_LENGTH) fail(`participant.${key} must be at most 255 characters`);
  if (CONTROL_CHARACTERS.test(participant[key])) fail(`participant.${key} must not contain control characters`);
}
if (participant.model.length < 4) fail("participant.model must be at least 4 characters");
if (participant.model !== participant.model.trim()) fail("participant.model must be already trimmed");
if (participant.config !== undefined) {
  object(participant.config, "participant.config");
  if (Object.hasOwn(participant.config, "adapter") && !["api", "command"].includes(participant.config.adapter)) {
    fail("participant.config.adapter must be api or command");
  }
}

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
  submission: { kind: "run", runner_version: "tau3-banking-packager@1.0.1", run_date: input.run_date },
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
