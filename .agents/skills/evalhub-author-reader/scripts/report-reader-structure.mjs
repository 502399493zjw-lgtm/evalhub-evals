#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";

const PREVIEW_TASK_CASE_LIMIT = 5;
const CONTENT_ROLES = ["official-results", "about", "task-cases", "sources"];

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

  for (const file of publishedResultFiles(evalPath)) {
    const envelope = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const result of envelope.results ?? []) {
      results += 1;
      for (const view of result.supplementary_views ?? []) {
        supplementaryViews += 1;
        if (view.id) viewIds.add(view.id);
      }
    }
  }

  return { results, supplementaryViews, viewIds: [...viewIds].sort() };
}

function splitMarkdownRow(line) {
  const cells = [];
  let current = "";
  let escaped = false;
  for (const character of line.trim().replace(/^\|/u, "").replace(/\|$/u, "")) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      current += character;
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function isDividerRow(line) {
  const cells = splitMarkdownRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

function markdownStructure(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const headings = [];
  const allHeadings = [];
  const headingLevelJumps = [];
  const tables = [];
  let currentH2 = "";
  let currentHeading = null;
  let previousHeading = null;
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const headingMatch = /^(#{2,6})\s+(.+?)\s*$/u.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const heading = { level, text };
      if (previousHeading && level > previousHeading.level + 1) {
        headingLevelJumps.push({
          from: previousHeading,
          to: heading,
        });
      }
      allHeadings.push(heading);
      previousHeading = heading;
      currentHeading = heading;
      if (level === 2) {
        currentH2 = text;
        headings.push(currentH2);
      }
      continue;
    }

    if (!/^\s*\|/.test(line) || !isDividerRow(lines[index + 1] ?? "")) continue;
    const headers = splitMarkdownRow(line);
    const rows = [];
    index += 2;
    while (index < lines.length && /^\s*\|/.test(lines[index])) {
      rows.push(splitMarkdownRow(lines[index]));
      index += 1;
    }
    index -= 1;
    tables.push({
      heading: currentH2,
      sectionHeading: currentHeading?.text ?? currentH2,
      headers,
      rows,
      rowCount: rows.length,
    });
  }

  return { headings, allHeadings, headingLevelJumps, tables };
}

function headingRole(heading) {
  if (/榜单|官方.*(?:结果|成绩)|成绩.*分项|排名/iu.test(heading)) return "official-results";
  if (/题目案例|任务案例/u.test(heading)) return "task-cases";
  if (/一手资料|主要来源|primary sources/iu.test(heading)) return "sources";
  if (/关于.*评测|评测说明|方法|协议/u.test(heading)) return "about";
  return null;
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
  const markdown = isMarkdown ? profile.markdown : "";
  const structure = markdownStructure(markdown);
  const roleOrder = structure.headings.map(headingRole).filter((role) => role != null);
  const uniqueRoleOrder = roleOrder.filter((role, index) => roleOrder.indexOf(role) === index);
  const officialTables = structure.tables.filter((table) =>
    headingRole(table.heading) === "official-results"
    && table.headers.some((header) => /模型|model/iu.test(header)));
  const linkedModelCells = [];
  const officialResultTables = [];

  for (const table of officialTables) {
    const modelColumn = table.headers.findIndex((header) => /模型|model/iu.test(header));
    const models = [];
    for (const row of table.rows) {
      const cell = row[modelColumn] ?? "";
      if (cell.length > 0) models.push(cell);
      if (/\[[^\]]+\]\([^)]+\)/u.test(cell)) linkedModelCells.push(cell);
    }
    officialResultTables.push({
      heading: table.heading,
      sectionHeading: table.sectionHeading,
      headers: table.headers,
      rowCount: table.rowCount,
      models,
    });
  }

  const tablesBySection = new Map();
  for (const table of officialResultTables) {
    const sectionTables = tablesBySection.get(table.heading) ?? [];
    sectionTables.push(table);
    tablesBySection.set(table.heading, sectionTables);
  }
  const fragmentedOfficialResultSections = [];
  for (const [heading, tables] of tablesBySection) {
    const distinctModels = new Set(tables.flatMap((table) => table.models));
    if (tables.length > 1
      && tables.every((table) => table.rowCount <= 1)
      && distinctModels.size > 1) {
      fragmentedOfficialResultSections.push(heading);
    }
  }

  const officialModels = [...new Set(officialResultTables.flatMap((table) => table.models))].sort();

  const tasks = definition.tasks ?? [];
  return {
    id: definition.id,
    file: absolutePath,
    renderer: isMarkdown ? "markdown" : "structured",
    markdownH2: structure.headings,
    markdownHeadings: structure.allHeadings,
    headingLevelJumps: structure.headingLevelJumps,
    contentRoleOrder: uniqueRoleOrder,
    missingContentRoles: CONTENT_ROLES.filter((role) => !uniqueRoleOrder.includes(role)),
    markdownTableCount: structure.tables.length,
    officialResultMatrixCount: officialTables.length,
    officialResultMatrixRows: officialTables.map((table) => table.rowCount),
    officialResultTables,
    officialModels,
    fragmentedOfficialResultSections,
    linkedModelCells,
    tasks: tasks.length,
    ...taskCaseTranslationStats(tasks),
    ...resultCounts(absolutePath),
  };
}

export function compareReaders(reference, target) {
  const issues = [];
  const isSameEvaluation = Boolean(reference.id) && reference.id === target.id;
  if (target.renderer !== reference.renderer) {
    issues.push(`renderer differs: expected ${reference.renderer}, got ${target.renderer}`);
  }
  if (target.renderer !== "markdown") {
    issues.push("rebuilt reader must use detail_profile.markdown");
  }
  if (target.missingContentRoles.length > 0) {
    issues.push(`missing Markdown content roles: ${target.missingContentRoles.join(", ")}`);
  }
  if (target.renderer === "markdown"
    && JSON.stringify(target.contentRoleOrder) !== JSON.stringify(reference.contentRoleOrder)) {
    issues.push(
      `content role order differs: expected ${reference.contentRoleOrder.join(" > ")}, got ${target.contentRoleOrder.join(" > ")}`,
    );
  }
  if (target.officialResultMatrixCount === 0) {
    issues.push("at least one cross-model official result table is required");
  }
  if (target.fragmentedOfficialResultSections.length > 0) {
    issues.push(
      `official result families are fragmented into per-model tables: ${target.fragmentedOfficialResultSections.join(", ")}`,
    );
  }
  if (target.headingLevelJumps.length > 0) {
    issues.push(
      `Markdown heading levels must not skip: ${target.headingLevelJumps.map(({ from, to }) => `H${from.level} ${from.text} -> H${to.level} ${to.text}`).join("; ")}`,
    );
  }
  if (target.linkedModelCells.length > 0) {
    issues.push(`model names must be plain text: ${target.linkedModelCells.join("; ")}`);
  }
  if (isSameEvaluation) {
    const missingModels = reference.officialModels.filter(
      (model) => !target.officialModels.includes(model),
    );
    if (missingModels.length > 0) {
      issues.push(`official participants removed from the accepted reader: ${missingModels.join(", ")}`);
    }
    const missingTaskCases = reference.taskCaseIds.filter(
      (taskId) => !target.taskCaseIds.includes(taskId),
    );
    if (missingTaskCases.length > 0) {
      issues.push(`selected task cases removed from the accepted reader: ${missingTaskCases.join(", ")}`);
    }
  }
  if (target.taskCases > PREVIEW_TASK_CASE_LIMIT) {
    issues.push(`task-case count exceeds ${PREVIEW_TASK_CASE_LIMIT}: ${target.taskCases}`);
  }
  if (target.taskCaseTranslationCoverage < 1) {
    issues.push(
      `task-case translation coverage must be 100.0%, got ${(target.taskCaseTranslationCoverage * 100).toFixed(1)}%; missing: ${target.missingCaseTranslationTaskIds.join(", ") || "none"}`,
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
