#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";

export const CANONICAL_MODULES = [
  "hero",
  "leaderboard",
  "official-breakdown",
  "about",
  "task-cases",
  "resources",
  "footer",
];

const MARKDOWN_HEADINGS = [
  "榜单",
  "官方分项结果",
  "关于这套评测",
  "题目案例",
  "资料与分析",
];

const STRUCTURED_CORE_FIELDS = [
  "source_kind",
  "summary",
  "method_steps",
  "score_interpretation",
  "caveats",
  "resources",
];

const PREVIEW_TASK_CASE_LIMIT = 5;

function publishedResultFiles(evalPath) {
  const directory = path.join(path.dirname(evalPath), "published-results");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(directory, name));
}

function resultCounts(evalPath) {
  let results = 0;
  let supplementaryViews = 0;
  const viewIds = new Set();
  const splitParticipantMetricTableGroups = new Set();

  for (const file of publishedResultFiles(evalPath)) {
    const envelope = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const result of envelope.results ?? []) {
      results += 1;
      const views = result.supplementary_views ?? [];
      const participantMetricTables = views.filter((view) =>
        view.type === "metric_table"
        && Array.isArray(view.rows)
        && view.rows.length === 1
        && typeof view.id === "string"
        && view.id.length > 0);
      if (participantMetricTables.length > 1) {
        splitParticipantMetricTableGroups.add(
          participantMetricTables.map((view) => view.id).sort().join(" + "),
        );
      }
      for (const view of views) {
        supplementaryViews += 1;
        if (view.id) viewIds.add(view.id);
      }
    }
  }

  return {
    results,
    supplementaryViews,
    viewIds: [...viewIds].sort(),
    splitParticipantMetricTableGroups: [...splitParticipantMetricTableGroups].sort(),
  };
}

function markdownH2(markdown) {
  let inFence = false;
  const headings = [];
  for (const line of markdown.split(/\r?\n/u)) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      const match = /^##\s+(.+?)\s*$/.exec(line);
      if (match) headings.push(match[1]);
    }
  }
  return headings;
}

function previewTaskCases(tasks, limit = PREVIEW_TASK_CASE_LIMIT) {
  const sampleCount = Math.min(limit, tasks.length);
  if (sampleCount <= 1) return tasks.slice(0, sampleCount);
  return Array.from({ length: sampleCount }, (_, index) => {
    const taskIndex = Math.round((index * (tasks.length - 1)) / (sampleCount - 1));
    return tasks[taskIndex];
  });
}

function taskCaseTranslationStats(tasks) {
  const taskCases = previewTaskCases(tasks);
  const missingCaseTranslationTaskIds = [];
  const summarizedCaseTranslationTaskIds = [];
  let translatedTaskCases = 0;

  for (const task of taskCases) {
    const prompt = typeof task?.prompt === "string" ? task.prompt.trim() : "";
    const translation = typeof task?.translation === "string" ? task.translation.trim() : "";
    const taskId = typeof task?.id === "string" && task.id.length > 0 ? task.id : "<missing-id>";
    if (translation.length === 0) {
      missingCaseTranslationTaskIds.push(taskId);
      continue;
    }
    translatedTaskCases += 1;
    // Chinese full-text renderings are normally shorter than English source text,
    // but a translation under one fifth of a long prompt is almost certainly an
    // abstract. This is a deterministic review signal, not a semantic proof.
    if (prompt.length >= 300 && translation.length < prompt.length * 0.2) {
      summarizedCaseTranslationTaskIds.push(taskId);
    }
  }

  return {
    taskCaseIds: taskCases.map((task) =>
      typeof task?.id === "string" && task.id.length > 0 ? task.id : "<missing-id>"),
    taskCases: taskCases.length,
    translatedTaskCases,
    taskCaseTranslationCoverage:
      taskCases.length === 0 ? 1 : translatedTaskCases / taskCases.length,
    missingCaseTranslationTaskIds,
    summarizedCaseTranslationTaskIds,
  };
}

export function inspectReader(evalPath) {
  const absolutePath = path.resolve(evalPath);
  const definition = YAML.parse(fs.readFileSync(absolutePath, "utf8"));
  const profile = definition.detail_profile ?? {};
  const isMarkdown = typeof profile.markdown === "string";
  const counts = resultCounts(absolutePath);
  const tasks = definition.tasks ?? [];
  const translationStats = taskCaseTranslationStats(tasks);
  const h2 = isMarkdown ? markdownH2(profile.markdown) : [];
  const missingCoreFields = isMarkdown
    ? [...STRUCTURED_CORE_FIELDS]
    : STRUCTURED_CORE_FIELDS.filter((field) => profile[field] == null);

  return {
    id: definition.id,
    file: absolutePath,
    renderer: isMarkdown ? "markdown" : "structured",
    moduleOrder: isMarkdown
      ? ["hero", ...h2.map((heading) => MARKDOWN_HEADINGS.includes(heading)
        ? CANONICAL_MODULES[MARKDOWN_HEADINGS.indexOf(heading) + 1]
        : `custom:${heading}`)]
      : [...CANONICAL_MODULES],
    markdownH2: h2,
    missingCoreFields,
    tasks: tasks.length,
    ...translationStats,
    ...counts,
  };
}

export function compareReaders(reference, target) {
  const issues = [];
  if (target.renderer !== reference.renderer) {
    issues.push(`renderer differs: expected ${reference.renderer}, got ${target.renderer}`);
  }
  if (JSON.stringify(target.moduleOrder) !== JSON.stringify(reference.moduleOrder)) {
    issues.push(`module order differs: expected ${reference.moduleOrder.join(" > ")}, got ${target.moduleOrder.join(" > ")}`);
  }
  if (target.missingCoreFields.length > 0) {
    issues.push(`missing structured core fields: ${target.missingCoreFields.join(", ")}`);
  }
  if (target.splitParticipantMetricTableGroups.length > 0) {
    issues.push(
      `participant metrics are split across mergeable one-row tables: ${target.splitParticipantMetricTableGroups.join("; ")}`,
    );
  }
  if (target.taskCaseTranslationCoverage < reference.taskCaseTranslationCoverage) {
    issues.push(
      `task-case translation coverage differs: expected ${(reference.taskCaseTranslationCoverage * 100).toFixed(1)}%, got ${(target.taskCaseTranslationCoverage * 100).toFixed(1)}%; missing: ${target.missingCaseTranslationTaskIds.join(", ") || "none"}`,
    );
  }
  if (target.summarizedCaseTranslationTaskIds.length > 0) {
    issues.push(
      `long task-case translations appear summarized instead of full-text: ${target.summarizedCaseTranslationTaskIds.join(", ")}`,
    );
  }
  return issues;
}

function parseArguments(argv) {
  const args = [...argv];
  const referenceIndex = args.indexOf("--reference");
  if (referenceIndex < 0 || !args[referenceIndex + 1]) {
    throw new Error("usage: report-reader-structure.mjs --reference <eval.yaml> <target-eval.yaml> [...]");
  }
  const reference = args[referenceIndex + 1];
  args.splice(referenceIndex, 2);
  if (args.length === 0) throw new Error("at least one target eval.yaml is required");
  return { reference, targets: args };
}

export function run(argv) {
  const { reference: referencePath, targets } = parseArguments(argv);
  const reference = inspectReader(referencePath);
  const reports = targets.map((targetPath) => {
    const target = inspectReader(targetPath);
    const issues = compareReaders(reference, target);
    return { ...target, matchesReference: issues.length === 0, issues };
  });
  process.stdout.write(`${JSON.stringify({ reference, targets: reports }, null, 2)}\n`);
  return reports.every((report) => report.matchesReference) ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
