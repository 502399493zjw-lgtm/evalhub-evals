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
const packer = path.join(evalDirectory, "pack-to-result.mjs");
const exampleSubmission = path.join(
  evalDirectory,
  "tasks",
  "example-submission.json",
);
const sampleResult = path.join(evalDirectory, "sample-result.json");

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

test("packs the RSI-Bench fixture with explicit verification scope", async (t) => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "rsibench-data-"),
  );
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const output = path.join(temporaryDirectory, "result.json");
  const run = spawnSync(
    process.execPath,
    [packer, exampleSubmission, "--out", output],
    { encoding: "utf8" },
  );

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /声明格式与内部一致性检查通过/u);
  assert.match(run.stdout, /公开 artifact 内容、模型身份及成绩真实性待评测作者审核/u);
  assert.doesNotMatch(run.stdout, /已校验/u);

  const result = await readJson(output);
  assert.match(result.results[0].detail, /只完成声明格式与内部一致性检查/u);
  assert.match(
    result.results[0].detail,
    /不验证公开 artifact 内容、模型身份、运行过程或成绩真实性/u,
  );
  assert.deepEqual(result, await readJson(sampleResult));
});
