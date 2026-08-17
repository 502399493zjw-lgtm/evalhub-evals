import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compareReaders, inspectReader } from "./report-reader-structure.mjs";

function fixture(root, slug, detailProfile, task = {}, definitionId = slug) {
  const directory = path.join(root, "evals", slug);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "eval.yaml"), [
    `id: ${definitionId}`,
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

const markdownProfile = [
  "source_kind: upstream_publication",
  "markdown: |-",
  "  ## 榜单",
  "",
  "  | 模型 | 官方总分 | 分项 | harness |",
  "  | --- | ---: | ---: | --- |",
  "  | Model | 1 | 1 | 题目默认 harness |",
  "",
  "  ## 官方分项结果",
  "",
  "  汇总分等于官方分项的宏平均。",
  "",
  "  ## 关于此评测",
  "",
  "  完整说明方法、评分与边界。",
  "",
  "  ## 题目案例",
  "",
  "  展示完整原文与中文翻译。",
  "",
  "  ## 一手资料",
  "",
  "  - https://official.example.org/source",
].join("\n");

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

test("Markdown targets match the RSIBench content contract", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", markdownProfile));
  const target = inspectReader(fixture(root, "target", markdownProfile));
  assert.equal(target.renderer, "markdown");
  assert.equal(target.officialResultMatrixCount, 1);
  assert.deepEqual(compareReaders(reference, target), []);
});

test("structured targets fail a Markdown rebuild", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", markdownProfile));
  const target = inspectReader(fixture(root, "target", structuredProfile));
  const issues = compareReaders(reference, target);
  assert.ok(issues.some((issue) => issue.startsWith("renderer differs")));
  assert.ok(issues.includes("rebuilt reader must use detail_profile.markdown"));
});

test("missing selected task-case translations fail readiness", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", markdownProfile));
  const target = inspectReader(fixture(root, "target", markdownProfile, { translation: "" }));
  const issues = compareReaders(reference, target);
  assert.equal(target.taskCaseTranslationCoverage, 0);
  assert.deepEqual(target.missingCaseTranslationTaskIds, ["one-task"]);
  assert.ok(issues.some((issue) => issue.startsWith("task-case translation coverage must be")));
});

test("short summaries do not pass as translations of long task prompts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const longPrompt = "Complete every required step and preserve all literals. ".repeat(8);
  const reference = inspectReader(fixture(root, "reference", markdownProfile, {
    prompt: longPrompt,
    translation: "完整执行每一个步骤并保留所有字面量。".repeat(8),
  }));
  const target = inspectReader(fixture(root, "target", markdownProfile, {
    prompt: longPrompt,
    translation: "完成任务摘要。",
  }));
  const issues = compareReaders(reference, target);
  assert.deepEqual(target.summarizedCaseTranslationTaskIds, ["one-task"]);
  assert.ok(issues.some((issue) => issue.startsWith("long task-case translations appear summarized")));
});

test("non-case tasks may omit translations", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const referencePath = fixture(root, "reference", markdownProfile);
  const targetPath = fixture(root, "target", markdownProfile);
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

test("multiple cross-model result families pass the reader contract", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", markdownProfile));
  const familyProfile = markdownProfile.replace(
    "  汇总分等于官方分项的宏平均。",
    [
      "  | 模型 | 分项 A | 分项 B |",
      "  | --- | ---: | ---: |",
      "  | Model A | 1 | 2 |",
      "  | Model B | 0.9 | 1.8 |",
      "",
      "  ### 资源与执行",
      "",
      "  | 模型 | 小时 | 成本 |",
      "  | --- | ---: | ---: |",
      "  | Model A | 10 | 20 |",
      "  | Model B | 12 | 22 |",
    ].join("\n"),
  );
  const target = inspectReader(fixture(root, "target", familyProfile));
  assert.equal(target.officialResultMatrixCount, 3);
  assert.equal(target.fragmentedOfficialResultSections.length, 0);
  assert.deepEqual(compareReaders(reference, target), []);
});

test("same-eval regression comparison rejects collapsing compact result families into one wide table", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const acceptedProfile = markdownProfile.replace(
    "  汇总分等于官方分项的宏平均。",
    [
      "  ### 六项分项成绩",
      "",
      "  | 模型 | 分项 A | 分项 B | 分项 C | 分项 D | 分项 E | 分项 F |",
      "  | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
      "  | Model | 1 | 1 | 1 | 1 | 1 | 1 |",
      "",
      "  ### 资源与运行成本",
      "",
      "  | 模型 | 小时 | 成本 |",
      "  | --- | ---: | ---: |",
      "  | Model | 10 | 20 |",
    ].join("\n"),
  );
  const wideProfile = markdownProfile.replace(
    "  汇总分等于官方分项的宏平均。",
    [
      "  ### 六项分项成绩",
      "",
      "  | 模型 | 分项 A | 分项 B | 分项 C | 分项 D | 分项 E | 分项 F | 官方总分 | 小时 | 成本 | harness |",
      "  | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
      "  | Model | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 10 | 20 | 题目默认 harness |",
    ].join("\n"),
  );
  const reference = inspectReader(fixture(
    root, "accepted", acceptedProfile, {}, "same-eval",
  ));
  const target = inspectReader(fixture(
    root, "candidate", wideProfile, {}, "same-eval",
  ));
  const issues = compareReaders(reference, target);
  assert.ok(issues.some((issue) => issue.startsWith("official result table families removed")));
  assert.ok(issues.some((issue) => issue.startsWith("official result table count decreased")));
  assert.ok(issues.some((issue) => issue.startsWith("official result table width increased materially")));
  assert.ok(issues.some((issue) => issue.startsWith("official fields are newly duplicated")));
});

test("per-model result tables fail the family-level cross-model contract", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", markdownProfile));
  const splitProfile = markdownProfile.replace(
    "  | Model | 1 | 1 | 题目默认 harness |",
    [
      "  | Model A | 1 | 1 | 题目默认 harness |",
      "",
      "  | 模型 | 官方总分 | 分项 | harness |",
      "  | --- | ---: | ---: | --- |",
      "  | Model B | 0.9 | 0.9 | 题目默认 harness |",
    ].join("\n"),
  );
  const target = inspectReader(fixture(root, "target", splitProfile));
  const issues = compareReaders(reference, target);
  assert.equal(target.officialResultMatrixCount, 2);
  assert.deepEqual(target.fragmentedOfficialResultSections, ["榜单"]);
  assert.ok(issues.some((issue) => issue.startsWith("official result families are fragmented")));
});

test("heading level jumps fail the Markdown hierarchy contract", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", markdownProfile));
  const jumpingProfile = markdownProfile.replace(
    "  汇总分等于官方分项的宏平均。",
    "  #### 六项分项成绩\n\n  汇总分等于官方分项的宏平均。",
  );
  const target = inspectReader(fixture(root, "target", jumpingProfile));
  const issues = compareReaders(reference, target);
  assert.equal(target.headingLevelJumps.length, 1);
  assert.ok(issues.some((issue) => issue.startsWith("Markdown heading levels must not skip")));
});

test("linked model names fail the plain-text rule", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reader-structure-"));
  const reference = inspectReader(fixture(root, "reference", markdownProfile));
  const linkedProfile = markdownProfile.replace(
    "  | Model | 1 | 1 | 题目默认 harness |",
    "  | [Model](#model) | 1 | 1 | 题目默认 harness |",
  );
  const target = inspectReader(fixture(root, "target", linkedProfile));
  const issues = compareReaders(reference, target);
  assert.deepEqual(target.linkedModelCells, ["[Model](#model)"]);
  assert.ok(issues.some((issue) => issue.startsWith("model names must be plain text")));
});
