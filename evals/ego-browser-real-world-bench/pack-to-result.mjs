#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const SLUG = "ego-browser-real-world-bench";
const UPSTREAM_COMMIT = "f566ac293e4e6bd80c4e9b062b5699f04eac41f4";
const TASK_IDS = [
  "rwb-x-openai-7d-01",
  "rwb-openai-careers-apply-01",
  "rwb-redfin-mortgage-01",
  "rwb-expedia-flight-01",
  "rwb-hn-top10-01",
  "rwb-imdb-scifi-01",
  "rwb-calcnet-mortgage-01",
  "rwb-cars-payment-01",
  "rwb-yahoo-stocks-01",
  "rwb-yelp-opentable-01",
  "rwb-reddit-greenhouse-01",
  "rwb-reddit-pf-indexfund-01",
  "rwb-github-trending-py-01",
  "rwb-bankrate-compound-01",
  "rwb-metacritic-actionrpg-01",
  "rwb-stockanalysis-tech-01",
  "rwb-zillow-greatschools-austin-01",
  "rwb-xe-irs-reimbursement-01",
  "rwb-youtube-finance-channel-01",
  "rwb-amazon-bottle-leaks-01",
  "rwb-houzz-homedepot-backsplash-01",
  "rwb-google-flights-booking-miami-01",
  "rwb-courtlistener-sec-helix-01",
  "rwb-scratch-apple-dash-01",
  "rwb-2048-reach-256-01",
  "rwb-song-maker-mirror-loop-01",
  "rwb-census-sba-qcew-naics541511-01",
  "rwb-webflow-squarespace-wix-01",
  "rwb-nist-cisa-nvd-readiness-01",
  "rwb-bls-census-retail-metros-01",
  "rwb-lumen-ticket-rush-01"
];
const TASK_ID_SET = new Set(TASK_IDS);

function fail(message) {
  console.error(`pack-to-result: ${message}`);
  process.exitCode = 1;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} must contain exactly: ${wanted.join(", ")}`);
  }
}

function isIsoCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function validateManifest(value) {
  exactKeys(value, ["manifest_version", "eval_id", "protocol_revision", "upstream_commit", "participant", "run_date", "tasks"], "manifest");
  if (value.manifest_version !== 1) throw new Error("manifest_version must be 1");
  if (value.eval_id !== SLUG) throw new Error(`eval_id must be ${SLUG}`);
  if (value.protocol_revision !== 1) throw new Error("protocol_revision must be 1");
  if (value.upstream_commit !== UPSTREAM_COMMIT) throw new Error("upstream_commit must match the pinned source commit");
  exactKeys(value.participant, ["model", "harness", "harness_version"], "participant");
  for (const key of ["model", "harness", "harness_version"]) {
    if (typeof value.participant[key] !== "string" || value.participant[key].trim() === "") {
      throw new Error(`participant.${key} must be a non-empty string`);
    }
  }
  if (!isIsoCalendarDate(value.run_date)) throw new Error("run_date must be a real YYYY-MM-DD date");
  if (!Array.isArray(value.tasks) || value.tasks.length !== TASK_IDS.length) {
    throw new Error(`tasks must contain exactly ${TASK_IDS.length} task records`);
  }
  const seen = new Set();
  for (const [index, task] of value.tasks.entries()) {
    exactKeys(task, ["task_id", "all_rubrics_passed"], `tasks[${index}]`);
    if (!TASK_ID_SET.has(task.task_id)) throw new Error(`tasks[${index}].task_id is not a configured task`);
    if (seen.has(task.task_id)) throw new Error(`tasks[${index}].task_id is duplicated`);
    if (typeof task.all_rubrics_passed !== "boolean") throw new Error(`tasks[${index}].all_rubrics_passed must be boolean`);
    seen.add(task.task_id);
  }
  for (const taskId of TASK_IDS) {
    if (!seen.has(taskId)) throw new Error(`tasks is missing ${taskId}`);
  }
}

function buildResult(manifest, manifestSha256) {
  const byTaskId = new Map(manifest.tasks.map((task) => [task.task_id, task]));
  const taskResults = TASK_IDS.map((taskId) => {
    const passed = byTaskId.get(taskId).all_rubrics_passed;
    return { task_id: taskId, score: passed ? 1 : 0, raw: `all_rubrics_passed=${passed}` };
  });
  const passedTasks = taskResults.filter((task) => task.score === 1).length;
  const score = Number(((passedTasks / TASK_IDS.length) * 100).toFixed(6));
  return {
    eval_id: SLUG,
    submission: {
      kind: "run",
      runner_version: "ego-browser-real-world-bench/pack-to-result@1.0.0",
      run_date: manifest.run_date,
    },
    results: [{
      participant: manifest.participant,
      score,
      raw_metric: { label: "Perfect rate", value: `${passedTasks}/${TASK_IDS.length} tasks (${score.toFixed(6)}%)` },
      detail: `Packed from a ${TASK_IDS.length}-task upstream verdict manifest. Perfect rate = all-rubrics-passed tasks / ${TASK_IDS.length} x 100. Manifest SHA-256=${manifestSha256}. The external run evidence remains subject to author review.`,
      task_results: taskResults,
      supplementary_views: [{
        type: "metric_table",
        id: "task-perfect-outcomes",
        label: "Task verdicts",
        title: "All-rubrics-passed verdict by task",
        columns: ["Task ID", "All rubrics passed"],
        rows: taskResults.map((task) => ({ cells: [task.task_id, task.score === 1 ? "true" : "false"] })),
        note: "Values are submitted manifest records used to calculate the primary score; this table does not independently rejudge the upstream run.",
      }],
    }],
  };
}

async function loadEvalContext() {
  const evalYamlPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "eval.yaml");
  const parsed = EvalDefSchema.safeParse(parseYaml(await readFile(evalYamlPath, "utf8")));
  if (!parsed.success) {
    throw new Error(`eval.yaml is invalid: ${JSON.stringify(parsed.error.issues)}`);
  }
  if (parsed.data.protocol_revision !== 1) {
    throw new Error("eval.yaml protocol_revision must match this packer");
  }
  return parsed.data;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args[1] !== "--out") {
    throw new Error("usage: node pack-to-result.mjs <submission.json> --out <result.json>");
  }
  const [inputPath, , outputPath] = args;
  if (path.basename(outputPath) !== outputPath || !outputPath.endsWith(".json")) {
    throw new Error("--out must be a safe JSON basename");
  }
  const inputText = await readFile(inputPath, "utf8");
  const manifest = JSON.parse(inputText);
  validateManifest(manifest);
  const manifestSha256 = createHash("sha256").update(inputText, "utf8").digest("hex");
  const result = buildResult(manifest, manifestSha256);
  const structural = ResultFileSchema.safeParse(result);
  if (!structural.success) {
    throw new Error(`Generated result does not match the result schema: ${JSON.stringify(structural.error.issues)}`);
  }
  const contextual = validateResultForEval(await loadEvalContext(), structural.data);
  if (!contextual.success) {
    throw new Error(`Generated result does not match this eval: ${JSON.stringify(contextual.error.issues)}`);
  }
  await writeFile(outputPath, JSON.stringify(structural.data, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outputPath}: ${structural.data.results[0].raw_metric.value}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
