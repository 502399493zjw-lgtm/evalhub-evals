import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "../..");
const evalDirectory = path.join(repositoryRoot, "evals", "rsibench-data");
const importer = path.join(evalDirectory, "official-result-to-envelope.mjs");

const identities = new Map([
  ["claude-code-opus-4.8", { model: "Opus-4.8", harness: "Claude Code" }],
  ["claude-code-sonnet-5", { model: "Sonnet-5", harness: "Claude Code" }],
  ["codex-gpt-5.6-sol", { model: "gpt-5.6-sol", harness: "Codex" }],
  ["codex-gpt-5.6-terra", { model: "gpt-5.6-terra", harness: "Codex" }],
]);

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("keeps the upstream model and harness as separate participant fields", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rsibench-official-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  for (const [participant, identity] of identities) {
    const output = path.join(root, `${participant}.json`);
    const run = spawnSync(
      process.execPath,
      [importer, "--participant", participant, "--out", output],
      { cwd: repositoryRoot, encoding: "utf8" },
    );
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(
      await readFile(output),
      await readFile(
        path.join(evalDirectory, "published-results", `${participant}.json`),
      ),
    );
    const envelope = await readJson(output);
    assert.equal(envelope.submission.kind, "upstream_author_publication");
    assert.deepEqual(envelope.results[0].participant, identity);
    assert.ok(!envelope.results[0].participant.model.includes(" · "));
    assert.ok(!Object.hasOwn(envelope, "eval_commit"));
  }
});
