import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compareReaders, inspectReader } from "./report-reader-structure.mjs";

function fixture(root, slug, detailProfile, task = {}) {
  const directory = path.join(root, "evals", slug);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "eval.yaml"), [
    `id: ${slug}`,
    "detail_profile:",
    detailProfile.split("\n").map((line) => `  ${line}`).join("\n"),
    "tasks:",
    "  - id: one-task",
    `    prompt: ${task.prompt ?? "Complete task"}`,
    `    translation: ${task.translation ?? "完成任务"}`,
    "",
  ].join("\n"));
  fs.mkdirSync(path.join(directory, "published-results"));
  fs.writeFileSync(path.join(directory, "published-results", "official.json"), JSON.stringify({
    results: [{
      participant: { model: "Model" },
      score: 1,
      supplementary_views: [{ id: "official-breakdown" }],
    }],
  }));
  return path.join(directory, "eval.yaml");
}

const structuredProfile = [
  "source_kind: upstream_publication",
  "summary:",
  "  plain_language: Plain",
  "  why_it_matters: Matters",
  "method_steps:",
  "  - title: Prepare",
  "    description: Prepare input",
  "  - title: Judge",
  "    description: Judge output",
  "score_interpretation: Higher is better",
  "caveats:",
  "  - title: Boundary",
  "    description: One run",
  "resources:",
  "  - title: Official",
  "    summary: Source",
  "    url: https://official.example.org/source",
].join("\n");

test("structured targets match the RSIBench module signature", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", structuredProfile));
  const target = inspectReader(fixture(root, "target", structuredProfile));
  assert.deepEqual(compareReaders(reference, target), []);
});

test("missing selected task-case translations fail RSIBench parity", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", structuredProfile));
  const target = inspectReader(fixture(root, "target", structuredProfile, { translation: "" }));
  const issues = compareReaders(reference, target);
  assert.equal(target.taskCaseTranslationCoverage, 0);
  assert.deepEqual(target.missingCaseTranslationTaskIds, ["one-task"]);
  assert.ok(issues.some((issue) => issue.startsWith("task-case translation coverage differs")));
});

test("short summaries do not pass as translations of long task prompts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const longPrompt = "Complete every required step and preserve all literals. ".repeat(8);
  const reference = inspectReader(fixture(root, "reference", structuredProfile, {
    prompt: longPrompt,
    translation: "完整执行每一个步骤并保留所有字面量。".repeat(8),
  }));
  const target = inspectReader(fixture(root, "target", structuredProfile, {
    prompt: longPrompt,
    translation: "完成任务摘要。",
  }));
  const issues = compareReaders(reference, target);
  assert.deepEqual(target.summarizedCaseTranslationTaskIds, ["one-task"]);
  assert.ok(issues.some((issue) => issue.startsWith("long task-case translations appear summarized")));
});

test("non-case tasks may omit translations", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const referencePath = fixture(root, "reference", structuredProfile);
  const targetPath = fixture(root, "target", structuredProfile);
  for (const evalPath of [referencePath, targetPath]) {
    const document = fs.readFileSync(evalPath, "utf8");
    const extraTasks = Array.from({ length: 5 }, (_, index) => [
      `  - id: extra-${index + 1}`,
      `    prompt: Extra prompt ${index + 1}`,
      ...(index === 1 ? [] : [`    translation: 额外题目 ${index + 1}`]),
    ].join("\n")).join("\n");
    fs.writeFileSync(evalPath, `${document.trimEnd()}\n${extraTasks}\n`);
  }

  const target = inspectReader(targetPath);
  assert.deepEqual(target.taskCaseIds, ["one-task", "extra-1", "extra-3", "extra-4", "extra-5"]);
  assert.equal(target.taskCaseTranslationCoverage, 1);
  assert.deepEqual(compareReaders(inspectReader(referencePath), target), []);
});

test("markdown is reported as a renderer and module-order mismatch", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", structuredProfile));
  const markdown = [
    "source_kind: upstream_publication",
    "markdown: |-",
    "  ## 关于这套评测",
    "  Body",
    "  ## 榜单",
    "  Body",
  ].join("\n");
  const target = inspectReader(fixture(root, "target", markdown));
  const issues = compareReaders(reference, target);
  assert.equal(target.renderer, "markdown");
  assert.ok(issues.some((issue) => issue.startsWith("renderer differs")));
  assert.ok(issues.some((issue) => issue.startsWith("module order differs")));
});

test("split one-row participant metric tables fail the unified breakdown contract", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", structuredProfile));
  const targetPath = fixture(root, "target", structuredProfile);
  const resultPath = path.join(path.dirname(targetPath), "published-results", "official.json");
  const envelope = JSON.parse(fs.readFileSync(resultPath, "utf8"));
  envelope.results[0].supplementary_views = [
    {
      type: "metric_table",
      id: "performance",
      rows: [{ cells: ["87.1%"] }],
    },
    {
      type: "metric_table",
      id: "judging-pricing",
      rows: [{ cells: ["verified"] }],
    },
  ];
  fs.writeFileSync(resultPath, JSON.stringify(envelope));

  const target = inspectReader(targetPath);
  const issues = compareReaders(reference, target);
  assert.deepEqual(target.splitParticipantMetricTableGroups, ["judging-pricing + performance"]);
  assert.ok(issues.some((issue) => issue.startsWith("participant metrics are split")));
});
