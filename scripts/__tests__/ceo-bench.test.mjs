import assert from "node:assert/strict";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const evalDirectory = path.join(repositoryRoot, "evals", "ceo-bench");
const packer = path.join(evalDirectory, "pack-to-result.mjs");
const sanitizer = path.join(evalDirectory, "sanitize-history.mjs");
const exampleSubmission = path.join(evalDirectory, "tasks", "example-evidence");
const officialResultsSnapshot = path.join(
  evalDirectory,
  "tasks",
  "princeton-official-results-2026-07-23.json",
);
const trajectoryManifestSummary = path.join(
  evalDirectory,
  "tasks",
  "princeton-trajectory-manifest-v12-summary.json",
);

async function makeFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ceo-bench-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tasks = path.join(root, "tasks");
  await cp(exampleSubmission, tasks, { recursive: true });
  return {
    root,
    tasks,
    manifest: path.join(tasks, "submission.json"),
    output: path.join(root, "result.json"),
  };
}

function runPacker(manifest, output, extraArgs = []) {
  return spawnSync(
    process.execPath,
    [packer, manifest, "--out", output, ...extraArgs],
    { encoding: "utf8" },
  );
}

function runSanitizer(input, output) {
  return spawnSync(
    process.execPath,
    [sanitizer, input, "--out", output],
    { encoding: "utf8" },
  );
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sanitizedHistory(currentDay) {
  const records = [];
  for (let day = 7; day <= currentDay; day += 7) {
    records.push({ type: "next_week", day });
  }
  if (currentDay % 7 !== 0) {
    records.push({ type: "next_week", day: currentDay });
  }
  records.push({
    type: "query",
    sql: "SELECT COALESCE(SUM(amount), 0) AS final_cash FROM ledger",
    row_count: 1,
    success: true,
  });
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

async function setRunOutcome(tasks, runNumber, { currentDay, finalCash }) {
  const runDir = path.join(tasks, `run-${runNumber}`);
  const statusPath = path.join(runDir, "status.json");
  const sessionsPath = path.join(runDir, "list-sessions.json");
  const finalCashPath = path.join(runDir, "final-cash.json");
  const historyPath = path.join(runDir, "history.jsonl");
  const status = await readJson(statusPath);
  const sessions = await readJson(sessionsPath);
  const finalCashResult = await readJson(finalCashPath);
  status.current_day = currentDay;
  sessions.sessions[0].current_day = currentDay;
  finalCashResult.rows[0].final_cash = finalCash;
  await Promise.all([
    writeJson(statusPath, status),
    writeJson(sessionsPath, sessions),
    writeJson(finalCashPath, finalCashResult),
    writeFile(historyPath, sanitizedHistory(currentDay)),
  ]);
}

test("packs exactly three valid trials and selects the best completed run", async (t) => {
  const fixture = await makeFixture(t);
  const run = runPacker(fixture.manifest, fixture.output, [
    "--eval-commit",
    "abcdef1",
  ]);

  assert.equal(run.status, 0, run.stderr);
  const result = await readJson(fixture.output);
  const entry = result.results[0];
  assert.equal(result.eval_id, "ceo-bench");
  assert.equal(result.eval_commit, "abcdef1");
  assert.equal(
    result.submission.runner_version,
    "ceo-bench/pack-to-result@2.0.0",
  );
  assert.equal(result.submission.run_date, "2026-07-23");
  assert.equal(entry.score, null);
  assert.equal(entry.participant.config.selected_trial, "b2c3d4e5f6a7");
  assert.equal(entry.raw_metric.tiebreak_value, 497);
  assert.equal(
    entry.participant.config.protocol_profile,
    "evalhub-fixed-weekly-v1",
  );
  assert.ok(!Object.hasOwn(entry.participant.config, "nominal_days"));
  assert.ok(!Object.hasOwn(entry.participant.config, "effective_days"));
  assert.ok(!Object.hasOwn(entry.participant.config, "total_days"));
  assert.ok(!Object.hasOwn(entry.participant.config, "weeks"));
  assert.match(entry.raw_metric.value, /\$1,500,000\.00/);
  assert.doesNotMatch(entry.raw_metric.value, /497 天|71 个整周/);
  assert.match(entry.detail, /作者回填最高完整终局现金/);
  assert.doesNotMatch(entry.detail, /497 天|71 个整周/);
  assert.match(entry.participant.config.evidence_fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(entry.showcases[1].turns.length, 4);
});

test("pins Princeton published scores separately from EvalHub rerun claims", async () => {
  const snapshot = await readJson(officialResultsSnapshot);
  const trajectorySummary = await readJson(trajectoryManifestSummary);
  const scores = new Map(
    snapshot.results.map((result) => [result.model_display, result.score_usd]),
  );

  assert.equal(snapshot.source_kind, "upstream_official_publication");
  assert.equal(snapshot.results.length, 17);
  assert.equal(scores.size, 17);
  assert.equal(scores.get("Claude Fable 5"), 12630078);
  assert.equal(scores.get("GPT-5.6 Sol"), 11313982);
  assert.equal(scores.get("Grok 4.20"), 0);
  assert.match(snapshot.score_authority.sha256, /^[a-f0-9]{64}$/u);
  assert.match(snapshot.trajectory_support.sha256, /^[a-f0-9]{64}$/u);
  assert.match(snapshot.verification_scope, /does not claim an independent EvalHub rerun/u);
  assert.match(snapshot.public_display_policy, /day counts may remain in internal provenance/u);
  assert.ok(snapshot.references.every((reference) => reference.participant === false));
  const gemini = snapshot.results.find(
    (result) => result.model_display === "Gemini 3.5 Flash",
  );
  const grok = snapshot.results.find(
    (result) => result.model_display === "Grok 4.5",
  );
  assert.equal(gemini.manifest_alignment, "cohort_conflict");
  assert.equal(grok.manifest_model, null);
  assert.equal(grok.manifest_alignment, "missing");
  assert.equal(trajectorySummary.models.length, 16);
  assert.equal(
    trajectorySummary.models.reduce(
      (total, model) => total + model.runs.length,
      0,
    ),
    48,
  );
  assert.ok(
    trajectorySummary.models.every((model) =>
      model.runs.every(
        (run) =>
          typeof run.run_id === "string" &&
          Number.isInteger(run.total_days) &&
          Number.isInteger(run.current_day) &&
          typeof run.bankrupt === "boolean",
      ),
    ),
  );
});

test("sanitizes upstream history with a deterministic field whitelist", async (t) => {
  const fixture = await makeFixture(t);
  const raw = path.join(fixture.root, "raw-history.jsonl");
  const firstOutput = path.join(fixture.root, "public-history-1.jsonl");
  const secondOutput = path.join(fixture.root, "public-history-2.jsonl");
  const secret = "synthetic-private-token";
  await writeFile(
    raw,
    [
      { type: "next_week", day: 1, timestamp: 1 },
      {
        type: "next_week",
        day: 7,
        rationale: secret,
        predictions: { cash_1wk: { point: 1, lower: 0, upper: 2 } },
        timestamp: 2,
      },
      {
        type: "python_exec",
        source: "inline",
        code_preview: `print("${secret}")`,
        exit_code: 0,
        timestamp: 3,
      },
      {
        type: "query",
        sql: "SELECT private_value FROM private_table",
        row_count: 1,
        success: true,
        timestamp: 4,
      },
      { type: "next_week", day: 14, rationale: secret, predictions: {}, timestamp: 5 },
      {
        type: "query",
        sql: "SELECT COALESCE(SUM(amount), 0) AS final_cash FROM ledger",
        row_count: 1,
        success: true,
        timestamp: 6,
      },
    ].map((record) => JSON.stringify(record)).join("\n") + "\n",
  );

  const first = runSanitizer(raw, firstOutput);
  const second = runSanitizer(raw, secondOutput);

  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  const firstBytes = await readFile(firstOutput);
  const secondBytes = await readFile(secondOutput);
  assert.deepEqual(firstBytes, secondBytes);
  assert.equal(
    firstBytes.toString("utf8"),
    `{"type":"next_week","day":7}\n` +
      `{"type":"next_week","day":14}\n` +
      `{"type":"query","sql":"SELECT COALESCE(SUM(amount), 0) AS final_cash FROM ledger","row_count":1,"success":true}\n`,
  );
  assert.ok(!firstBytes.includes(secret));
  assert.ok(!firstBytes.includes("private_table"));
  assert.ok(!firstBytes.includes("timestamp"));
});

test("requires the public final-cash query to be collected after the last advance", async (t) => {
  const fixture = await makeFixture(t);
  const raw = path.join(fixture.root, "early-query-history.jsonl");
  const output = path.join(fixture.root, "public-history.jsonl");
  await writeFile(
    raw,
    `{"type":"next_week","day":7,"rationale":"private"}\n` +
      `{"type":"query","sql":"SELECT COALESCE(SUM(amount), 0) AS final_cash FROM ledger","row_count":1,"success":true}\n` +
      `{"type":"next_week","day":14,"rationale":"private"}\n`,
  );

  const run = runSanitizer(raw, output);

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /缺少运行结束后的规定 final_cash 查询/);
  await assert.rejects(readFile(output), /ENOENT/);
});

test("rejects unredacted history without echoing private content", async (t) => {
  const fixture = await makeFixture(t);
  const historyPath = path.join(fixture.tasks, "run-1", "history.jsonl");
  const history = await readFile(historyPath, "utf8");
  const secret = "synthetic-private-marker";
  await writeFile(
    historyPath,
    history.replace(
      `{"type":"next_week","day":7}`,
      `{"type":"next_week","day":7,"rationale":"${secret}"}`,
    ),
  );

  const run = runPacker(fixture.manifest, fixture.output);

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /不是规范化的脱敏推进记录/);
  assert.ok(!run.stderr.includes(secret));
  await assert.rejects(readFile(fixture.output), /ENOENT/);
});

test("rejects a missing weekly boundary or misplaced final query", async (t) => {
  const fixture = await makeFixture(t);
  const historyPath = path.join(fixture.tasks, "run-1", "history.jsonl");
  const validLines = (await readFile(historyPath, "utf8")).trimEnd().split("\n");
  await writeFile(historyPath, `${validLines.filter((_, index) => index !== 1).join("\n")}\n`);

  const missingBoundary = runPacker(fixture.manifest, fixture.output);
  assert.notEqual(missingBoundary.status, 0);
  assert.match(missingBoundary.stderr, /完整的每周推进边界和唯一终局查询/);

  await writeFile(
    historyPath,
    `${validLines.at(-1)}\n${validLines.slice(0, -1).join("\n")}\n`,
  );
  const misplacedQuery = runPacker(fixture.manifest, fixture.output);
  assert.notEqual(misplacedQuery.status, 0);
  assert.match(misplacedQuery.stderr, /不是规范化的脱敏推进记录/);
});

test("rejects a non-bankrupt run that stops before the 497-day full-week boundary", async (t) => {
  const fixture = await makeFixture(t);
  await setRunOutcome(fixture.tasks, 1, { currentDay: 490, finalCash: 100 });

  const run = runPacker(fixture.manifest, fixture.output);

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /EvalHub 固定整周复现配置必须完成 497 天/);
  await assert.rejects(readFile(fixture.output), /ENOENT/);
});

test("rejects advancing an extra week to day 504", async (t) => {
  const fixture = await makeFixture(t);
  await setRunOutcome(fixture.tasks, 1, { currentDay: 504, finalCash: 100 });

  const run = runPacker(fixture.manifest, fixture.output);

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /current_day 必须在 1-497/);
  await assert.rejects(readFile(fixture.output), /ENOENT/);
});

test("when all trials bankrupts, selects longest survival and leaves score for author", async (t) => {
  const fixture = await makeFixture(t);
  await Promise.all([
    setRunOutcome(fixture.tasks, 1, { currentDay: 410, finalCash: -1 }),
    setRunOutcome(fixture.tasks, 2, { currentDay: 450, finalCash: -20 }),
  ]);

  const run = runPacker(fixture.manifest, fixture.output);

  assert.equal(run.status, 0, run.stderr);
  const entry = (await readJson(fixture.output)).results[0];
  assert.equal(entry.score, null);
  assert.equal(entry.participant.config.selected_trial, "b2c3d4e5f6a7");
  assert.equal(entry.raw_metric.tiebreak_value, 450);
  assert.match(entry.detail, /建议作者回填 0 USD/);
});

test("rejects fewer than three submitted trials", async (t) => {
  const fixture = await makeFixture(t);
  const manifest = await readJson(fixture.manifest);
  manifest.runs.pop();
  await writeJson(fixture.manifest, manifest);

  const run = runPacker(fixture.manifest, fixture.output);

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /必须恰好包含 3 次运行/);
});

test("rejects credentials before they can reach a public result", async (t) => {
  const fixture = await makeFixture(t);
  const manifest = await readJson(fixture.manifest);
  manifest.participant.config.api_key = "synthetic-secret";
  await writeJson(fixture.manifest, manifest);

  const run = runPacker(fixture.manifest, fixture.output);

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /疑似凭据字段/);
  await assert.rejects(readFile(fixture.output), /ENOENT/);
});

test("rejects models without a provider namespace", async (t) => {
  const fixture = await makeFixture(t);
  const manifest = await readJson(fixture.manifest);
  manifest.participant.model = "claude-sonnet-4-6-20260217";
  await writeJson(fixture.manifest, manifest);

  const run = runPacker(fixture.manifest, fixture.output);

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /必须包含 provider 命名空间/);
});

test("rejects a provider mismatch or non-maximum reasoning declaration", async (t) => {
  const fixture = await makeFixture(t);
  const manifest = await readJson(fixture.manifest);
  manifest.participant.config.provider = "openai";
  await writeJson(fixture.manifest, manifest);

  const mismatch = runPacker(fixture.manifest, fixture.output);
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /provider 命名空间必须与 participant\.config\.provider 一致/);

  manifest.participant.config.provider = "example";
  manifest.participant.config.reasoning_effort = "low";
  await writeJson(fixture.manifest, manifest);
  const lowReasoning = runPacker(fixture.manifest, fixture.output);
  assert.notEqual(lowReasoning.status, 0);
  assert.match(lowReasoning.stderr, /必须填写标准化值 "max"/);
});

test("rejects credential-bearing artifact URLs and missing final-cash history", async (t) => {
  const fixture = await makeFixture(t);
  const manifest = await readJson(fixture.manifest);
  manifest.runs[0].artifact_url =
    "https://example.com/evidence.zip?token=synthetic-secret";
  await writeJson(fixture.manifest, manifest);

  const unsafeUrl = runPacker(fixture.manifest, fixture.output);
  assert.notEqual(unsafeUrl.status, 0);
  assert.match(unsafeUrl.stderr, /不能包含 query 参数/);

  manifest.runs[0].artifact_url =
    "https://example.com/ceo-bench/synthetic-run-1-evidence.zip";
  await writeJson(fixture.manifest, manifest);
  await writeFile(
    path.join(fixture.tasks, "run-1", "history.jsonl"),
    sanitizedHistory(497)
      .trimEnd()
      .split("\n")
      .slice(0, -1)
      .join("\n") + "\n",
  );
  const missingQuery = runPacker(fixture.manifest, fixture.output);
  assert.notEqual(missingQuery.status, 0);
  assert.match(missingQuery.stderr, /完整的每周推进边界和唯一终局查询/);
});

test("rejects extra files in an evidence directory", async (t) => {
  const fixture = await makeFixture(t);
  await writeFile(
    path.join(fixture.tasks, "run-1", ".env"),
    "SYNTHETIC_API_KEY=must-not-be-published\n",
  );

  const run = runPacker(fixture.manifest, fixture.output);

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /只能包含规定的 6 个普通证据文件/);
  await assert.rejects(readFile(fixture.output), /ENOENT/);
});

test("rejects overwriting the manifest through a symlinked parent", async (t) => {
  const fixture = await makeFixture(t);
  const alias = path.join(fixture.root, "tasks-alias");
  await symlink(fixture.tasks, alias, "dir");
  const aliasedManifest = path.join(alias, "submission.json");

  const run = runPacker(aliasedManifest, fixture.manifest);

  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /输出文件不能覆盖 submission\.json/);
  assert.equal((await readJson(fixture.manifest)).runs.length, 3);
});

test("rejects a source commit mismatch and output paths inside evidence", async (t) => {
  const fixture = await makeFixture(t);
  const sourceCommit = path.join(
    fixture.tasks,
    "run-2",
    "source-commit.txt",
  );
  await writeFile(sourceCommit, "0000000000000000000000000000000000000000\n");
  const mismatched = runPacker(fixture.manifest, fixture.output);
  assert.notEqual(mismatched.status, 0);
  assert.match(mismatched.stderr, /必须是钉死版本/);

  await writeFile(sourceCommit, "f5d500688d95256906fd02cc5aa7524f2fe08d5b\n");
  const unsafeOutput = path.join(
    fixture.tasks,
    "run-1",
    "result.json",
  );
  const nested = runPacker(fixture.manifest, unsafeOutput);
  assert.notEqual(nested.status, 0);
  assert.match(nested.stderr, /输出文件不能位于 runs\[0\]\.evidence_dir 内/);
  await assert.rejects(readFile(unsafeOutput), /ENOENT/);
});
