import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const checker = path.join(
  repositoryRoot,
  ".agents/skills/evalhub-author-reader/scripts/check_detail_markdown.py",
);

async function checkFixture(t, heading) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "evalhub-detail-skill-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const evalYaml = path.join(directory, "eval.yaml");
  await writeFile(
    evalYaml,
    `id: task-browser-fixture\nname: Task browser fixture\ntasks:\n  - id: one\n    prompt: Complete prompt\ndetail_profile:\n  source_kind: evalhub_native\n  markdown: |-\n    ## ${heading}\n\n    Source-backed prose.\n`,
  );
  return spawnSync("python3", [checker, evalYaml], { encoding: "utf8" });
}

test("detail Markdown checker rejects duplicated task-case sections", async (t) => {
  const result = await checkFixture(t, "任务案例与研究观察");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /platform owns the interactive task-case browser/);
});

test("detail Markdown checker allows research observations beside structured tasks", async (t) => {
  const result = await checkFixture(t, "研究观察");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /detail Markdown check passed/);
});
