import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { compareReaders, inspectReader } from "./report-reader-structure.mjs";

function fixture(root, slug, detailProfile) {
  const directory = path.join(root, "evals", slug);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "eval.yaml"), [
    `id: ${slug}`,
    "detail_profile:",
    detailProfile.split("\n").map((line) => `  ${line}`).join("\n"),
    "tasks:",
    "  - id: one-task",
    "    prompt: Complete task",
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
