#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.join(
  scriptDirectory,
  "tasks",
  "real-world-bench.json",
);
const protocolPath = path.join(scriptDirectory, "tasks", "protocol.json");
const resourcesPath = path.join(scriptDirectory, "tasks", "resources.json");
const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_REASONING_LENGTH = 4_000;
const MAX_REPORTED_STEPS = 10_000;
const SYNTHETIC_REASONING =
  "Synthetic structure fixture built from the pinned task definition; no browser run or Judge call was performed.";
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/u;
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function exactKeys(value, expected, label) {
  invariant(isPlainObject(value), label + " must be an object");
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  invariant(
    JSON.stringify(actual) === JSON.stringify(wanted),
    label + " must contain exactly: " + wanted.join(", "),
  );
}

function nonEmptyString(value, label, maximum = 1_024) {
  invariant(typeof value === "string", label + " must be a string");
  invariant(value === value.trim(), label + " must be already trimmed");
  invariant(value.length > 0, label + " must not be empty");
  invariant(value.length <= maximum, label + " is too long");
  return value;
}

function boundedInteger(value, label, minimum, maximum) {
  invariant(Number.isSafeInteger(value), label + " must be a safe integer");
  invariant(
    value >= minimum && value <= maximum,
    label + " must be between " + minimum + " and " + maximum,
  );
  return value;
}

function sha256(value, label) {
  const normalized = nonEmptyString(value, label, 64);
  invariant(SHA256_PATTERN.test(normalized), label + " must be lowercase SHA-256");
  return normalized;
}

function parseTimestamp(value, label) {
  const normalized = nonEmptyString(value, label, 64);
  invariant(
    ISO_TIMESTAMP_PATTERN.test(normalized),
    label + " must be an ISO 8601 timestamp with an explicit offset",
  );
  const milliseconds = Date.parse(normalized);
  invariant(Number.isFinite(milliseconds), label + " is not a real timestamp");
  return { text: normalized, milliseconds };
}

function publicHttpsUrl(value, label) {
  const normalized = nonEmptyString(value, label, 2_048);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(label + " must be a valid URL");
  }
  invariant(parsed.protocol === "https:", label + " must use HTTPS");
  invariant(
    parsed.username === "" && parsed.password === "",
    label + " must not contain credentials",
  );
  invariant(
    parsed.search === "" && parsed.hash === "",
    label + " must not contain a query or fragment",
  );
  const hostname = parsed.hostname.toLowerCase();
  invariant(
    hostname !== "localhost" &&
      !hostname.endsWith(".localhost") &&
      !hostname.endsWith(".local"),
    label + " must not use a local hostname",
  );
  invariant(
    !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) && !hostname.includes(":"),
    label + " must not use an IP address",
  );
  return normalized;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return "[" + value.map((item) => stableJson(item)).join(",") + "]";
  }
  if (isPlainObject(value)) {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + stableJson(value[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function parseArguments(argv) {
  let inputPath;
  let outputPath;
  let evalCommit;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--out") {
      invariant(outputPath === undefined, "--out may be provided only once");
      outputPath = argv[index + 1];
      invariant(outputPath !== undefined, "--out requires a path");
      index += 1;
    } else if (token === "--eval-commit") {
      invariant(
        evalCommit === undefined,
        "--eval-commit may be provided only once",
      );
      evalCommit = argv[index + 1];
      invariant(evalCommit !== undefined, "--eval-commit requires a value");
      invariant(
        COMMIT_PATTERN.test(evalCommit),
        "--eval-commit must be 7-40 lowercase hexadecimal characters",
      );
      index += 1;
    } else if (!token.startsWith("-") && inputPath === undefined) {
      inputPath = token;
    } else {
      throw new Error("unknown or duplicate argument: " + token);
    }
  }
  invariant(inputPath !== undefined, "an explicit input JSON path is required");
  invariant(outputPath !== undefined, "--out is required");
  const resolvedInputPath = path.resolve(inputPath);
  const resolvedOutputPath = path.resolve(outputPath);
  invariant(
    resolvedInputPath !== resolvedOutputPath,
    "input and output paths must be different",
  );
  invariant(
    path.extname(resolvedOutputPath).toLowerCase() === ".json",
    "--out must name a JSON file",
  );
  return {
    inputPath: resolvedInputPath,
    outputPath: resolvedOutputPath,
    evalCommit,
  };
}

async function parseJsonFile(filePath, label) {
  const source = await readFile(filePath, "utf8");
  invariant(
    new TextEncoder().encode(source).byteLength <= MAX_INPUT_BYTES,
    label + " exceeds " + MAX_INPUT_BYTES + " bytes",
  );
  try {
    return { source, value: JSON.parse(source) };
  } catch (error) {
    throw new Error(label + " is invalid JSON: " + error.message);
  }
}

function buildValidationDefinition(dataset, protocol) {
  const validation = EvalDefSchema.safeParse({
    id: "real-world-bench",
    protocol_revision: protocol.protocol_revision,
    name: "Real World Bench",
    category: "useful",
    description: "Pinned Real World Bench external workflow.",
    dimensions: ["推理", "语言"],
    interface: "agent",
    runner: "custom",
    custom_mode: "external_workflow",
    scoring: "custom",
    scored_by: "author",
    score_policy: "required",
    baseline_policy: "optional",
    score_unit: "分",
    scoring_note:
      "The author reviews the complete externally judged evidence envelope.",
    command_template: {
      argv: [
        "node",
        "evals/real-world-bench/pack-to-result.mjs",
        "{input}",
        "--out",
        "{output}",
      ],
      output: "real-world-bench-result.json",
    },
    trials: 1,
    tasks: dataset.map((task) => ({
      id: task.task_id,
      prompt: task.confirmed_task,
    })),
  });
  invariant(
    validation.success,
    "internal real-world-bench validation definition is invalid",
  );
  return validation.data;
}

async function loadFrozenInputs() {
  const [datasetDocument, protocolDocument, resourcesDocument] = await Promise.all([
    parseJsonFile(datasetPath, "tasks/real-world-bench.json"),
    parseJsonFile(protocolPath, "tasks/protocol.json"),
    parseJsonFile(resourcesPath, "tasks/resources.json"),
  ]);
  const protocol = protocolDocument.value;
  invariant(isPlainObject(protocol), "protocol.json must be an object");
  const sourceRepository = publicHttpsUrl(
    protocol.source_snapshot?.repository,
    "protocol source repository",
  );
  const sourceCommit = nonEmptyString(
    protocol.source_snapshot?.commit,
    "protocol source commit",
    40,
  );
  invariant(
    COMMIT_PATTERN.test(sourceCommit),
    "protocol source commit must be lowercase hexadecimal",
  );
  const expectedDatasetSha = nonEmptyString(
    protocol.source_snapshot?.dataset_sha256,
    "protocol source dataset SHA-256",
    64,
  );
  const actualDatasetSha = createHash("sha256")
    .update(datasetDocument.source)
    .digest("hex");
  invariant(
    actualDatasetSha === expectedDatasetSha,
    "dataset content does not match protocol.json",
  );
  const expectedResourcesSha = sha256(
    protocol.source_snapshot?.resource_manifest_sha256,
    "protocol resource manifest SHA-256",
  );
  const actualResourcesSha = createHash("sha256")
    .update(resourcesDocument.source)
    .digest("hex");
  invariant(
    actualResourcesSha === expectedResourcesSha,
    "resources manifest does not match protocol.json",
  );
  const dataset = datasetDocument.value;
  invariant(Array.isArray(dataset), "dataset must be an array");
  invariant(
    dataset.length === protocol.dataset?.task_count,
    "dataset task count does not match protocol.json",
  );
  const taskIds = new Set();
  let rubricCount = 0;
  for (const [index, task] of dataset.entries()) {
    invariant(isPlainObject(task), "dataset task " + index + " must be an object");
    const taskId = nonEmptyString(task.task_id, "dataset task_id", 255);
    invariant(!taskIds.has(taskId), "duplicate dataset task_id " + taskId);
    taskIds.add(taskId);
    invariant(
      ["low", "medium", "high"].includes(task.level),
      taskId + ".level is invalid",
    );
    invariant(isPlainObject(task.rubrics), taskId + ".rubrics must be an object");
    const rubricIds = Object.keys(task.rubrics);
    invariant(
      rubricIds.length >= 3 && rubricIds.length <= 6,
      taskId + " must contain 3-6 rubrics",
    );
    for (const rubricId of rubricIds) {
      const rubric = task.rubrics[rubricId];
      invariant(isPlainObject(rubric), taskId + "." + rubricId + " is invalid");
      nonEmptyString(
        rubric.requirement,
        taskId + "." + rubricId + ".requirement",
        8_000,
      );
      nonEmptyString(
        rubric.verification,
        taskId + "." + rubricId + ".verification",
        16_000,
      );
    }
    rubricCount += rubricIds.length;
  }
  invariant(
    rubricCount === protocol.dataset?.rubric_count,
    "dataset rubric count does not match protocol.json",
  );

  const resources = resourcesDocument.value;
  exactKeys(
    resources,
    ["manifest_revision", "prepared_on", "publication_status", "resources"],
    "resources manifest",
  );
  invariant(resources.manifest_revision === 1, "resources manifest revision must be 1");
  nonEmptyString(resources.prepared_on, "resources prepared_on", 10);
  invariant(
    resources.publication_status === "published",
    "resources publication_status must be published",
  );
  invariant(Array.isArray(resources.resources), "resources must be an array");
  invariant(resources.resources.length === 2, "resources must contain exactly two entries");

  const resourceByTask = new Map();
  for (const resource of resources.resources) {
    invariant(isPlainObject(resource), "resource entry must be an object");
    const taskId = nonEmptyString(resource.task_id, "resource task_id", 255);
    invariant(taskIds.has(taskId), "resource references unknown task " + taskId);
    invariant(!resourceByTask.has(taskId), "duplicate resource task_id " + taskId);
    resourceByTask.set(taskId, resource);
  }

  const attachmentTask = dataset.find((task) => Array.isArray(task.attachments));
  invariant(attachmentTask !== undefined, "dataset attachment task is missing");
  invariant(
    dataset.filter((task) => Array.isArray(task.attachments)).length ===
      protocol.dataset?.attachment_task_count,
    "dataset attachment task count does not match protocol.json",
  );
  const attachmentResource = resourceByTask.get(attachmentTask.task_id);
  invariant(attachmentResource?.kind === "attachment", "attachment resource kind is invalid");
  invariant(
    stableJson(attachmentResource.dataset_declaration?.attachments) ===
      stableJson(attachmentTask.attachments),
    "attachment declaration does not match dataset",
  );
  invariant(
    attachmentResource.delivery_file?.filename === attachmentTask.attachments[0],
    "attachment filename does not match dataset",
  );
  invariant(
    sha256(attachmentResource.delivery_file?.sha256, "attachment SHA-256") ===
      protocol.source_snapshot?.resume_attachment_sha256,
    "attachment SHA-256 does not match protocol.json",
  );
  boundedInteger(
    attachmentResource.delivery_file?.bytes,
    "attachment byte length",
    1,
    2 * 1024 * 1024,
  );

  const siteTask = dataset.find((task) => typeof task.local_site === "string");
  invariant(siteTask !== undefined, "dataset local-site task is missing");
  invariant(
    dataset.filter((task) => typeof task.local_site === "string").length ===
      protocol.dataset?.local_site_task_count,
    "dataset local-site task count does not match protocol.json",
  );
  const siteResource = resourceByTask.get(siteTask.task_id);
  invariant(siteResource?.kind === "local_site", "local-site resource kind is invalid");
  invariant(
    siteResource.dataset_declaration?.local_site === siteTask.local_site &&
      siteResource.site_slug === siteTask.local_site,
    "local-site declaration does not match dataset",
  );
  const siteTreeSha = sha256(siteResource.source_tree_sha256, "site source-tree SHA-256");
  invariant(
    siteTreeSha === protocol.source_snapshot?.ticket_rush_source_tree_sha256,
    "site source-tree SHA-256 does not match protocol.json",
  );
  invariant(Array.isArray(siteResource.files), "site files must be an array");
  const canonicalSiteFiles = siteResource.files.map((file, index) => {
    exactKeys(file, ["path", "sha256"], "site file " + index);
    return {
      path: nonEmptyString(file.path, "site file path", 240),
      sha256: sha256(file.sha256, "site file SHA-256"),
    };
  });
  invariant(
    canonicalSiteFiles.every(
      (file, index) => index === 0 || canonicalSiteFiles[index - 1].path < file.path,
    ),
    "site files must be uniquely sorted by path",
  );
  const computedSiteTreeSha = createHash("sha256")
    .update(JSON.stringify(canonicalSiteFiles))
    .digest("hex");
  invariant(computedSiteTreeSha === siteTreeSha, "site source-tree fingerprint is invalid");

  const attachmentRepository = publicHttpsUrl(
    attachmentResource.source_repository,
    "attachment source repository",
  );
  const siteRepository = publicHttpsUrl(
    siteResource.source_repository,
    "site source repository",
  );
  invariant(
    sourceRepository === attachmentRepository &&
      sourceRepository === siteRepository,
    "published resources must use the frozen source repository",
  );
  invariant(
    attachmentResource.source_commit === sourceCommit &&
      siteResource.source_commit === sourceCommit,
    "published resources must use the frozen source commit",
  );
  publicHttpsUrl(
    attachmentResource.delivery_file.public_url,
    "attachment public URL",
  );
  publicHttpsUrl(
    attachmentResource.authoring_source?.public_url,
    "attachment authoring source URL",
  );
  publicHttpsUrl(siteResource.source_tree_url, "local-site source tree URL");

  invariant(resourceByTask.size === 2, "resource mapping is incomplete");
  return { dataset, protocol, resources };
}

function validateParticipant(value, protocol, inputKind) {
  exactKeys(
    value,
    ["model", "harness", "harness_version", "config"],
    "participant",
  );
  const participant = {
    model: nonEmptyString(value.model, "participant.model", 255),
    harness: nonEmptyString(value.harness, "participant.harness", 255),
    harness_version: nonEmptyString(
      value.harness_version,
      "participant.harness_version",
      255,
    ),
  };
  exactKeys(
    value.config,
    [
      "provider",
      "model_provider",
      "browser_tool",
      "browser_tool_mode",
      "browser_tool_version",
      "reasoning_effort",
    ],
    "participant.config",
  );
  participant.config = {
    provider: nonEmptyString(
      value.config.provider,
      "participant.config.provider",
      255,
    ),
    model_provider: nonEmptyString(
      value.config.model_provider,
      "participant.config.model_provider",
      255,
    ),
    browser_tool: nonEmptyString(
      value.config.browser_tool,
      "participant.config.browser_tool",
      255,
    ),
    browser_tool_mode: nonEmptyString(
      value.config.browser_tool_mode,
      "participant.config.browser_tool_mode",
      255,
    ),
    browser_tool_version: nonEmptyString(
      value.config.browser_tool_version,
      "participant.config.browser_tool_version",
      255,
    ),
    reasoning_effort: nonEmptyString(
      value.config.reasoning_effort,
      "participant.config.reasoning_effort",
      255,
    ),
  };
  const contract = protocol.submission_contract;
  invariant(
    participant.harness === contract.harness,
    "participant.harness must match the frozen harness",
  );
  invariant(
    participant.harness_version === contract.harness_version,
    "participant.harness_version must match the frozen source release",
  );
  invariant(
    participant.config.provider === contract.provider,
    "participant.config.provider must match the frozen provider",
  );
  invariant(
    participant.config.model_provider === contract.model_provider,
    "participant.config.model_provider must match the frozen model provider",
  );
  invariant(
    participant.config.browser_tool === contract.browser_tool,
    "participant.config.browser_tool must match the frozen browser tool",
  );
  invariant(
    participant.config.browser_tool_mode === contract.browser_tool_mode,
    "participant.config.browser_tool_mode must match the frozen browser tool mode",
  );
  invariant(
    participant.config.reasoning_effort === contract.reasoning_effort,
    "participant.config.reasoning_effort must match the frozen reasoning effort",
  );
  if (inputKind === "synthetic_fixture") {
    invariant(
      participant.model === "synthetic/no-model-run" &&
        participant.config.browser_tool_version ===
          "synthetic-structure-only",
      "synthetic fixture participant identity is fixed",
    );
  } else {
    invariant(
      !participant.model.startsWith("synthetic/"),
      "real runs cannot use a synthetic participant model",
    );
    invariant(
      participant.config.browser_tool_version !==
        "synthetic-structure-only",
      "real runs must declare the actual browser tool version",
    );
  }
  return participant;
}

function validateRun(value) {
  exactKeys(
    value,
    ["run_id", "started_at", "finished_at", "evidence_url", "evidence_sha256"],
    "run",
  );
  const runId = nonEmptyString(value.run_id, "run.run_id", 128);
  invariant(RUN_ID_PATTERN.test(runId), "run.run_id contains invalid characters");
  const started = parseTimestamp(value.started_at, "run.started_at");
  const finished = parseTimestamp(value.finished_at, "run.finished_at");
  invariant(
    finished.milliseconds >= started.milliseconds,
    "run.finished_at must not precede run.started_at",
  );
  return {
    runId,
    started,
    finished,
    evidenceUrl: publicHttpsUrl(value.evidence_url, "run.evidence_url"),
    evidenceSha256: sha256(value.evidence_sha256, "run.evidence_sha256"),
  };
}

function groupMetrics(items) {
  const taskCount = items.length;
  const totalRubrics = items.reduce((sum, item) => sum + item.totalRubrics, 0);
  const passedRubrics = items.reduce((sum, item) => sum + item.passedRubrics, 0);
  const perfectTasks = items.filter(
    (item) => item.passedRubrics === item.totalRubrics,
  ).length;
  const averageSteps =
    items.reduce((sum, item) => sum + item.steps, 0) / taskCount;
  const trajectoryEfficiency =
    (items.reduce(
      (sum, item) =>
        sum + item.passedRubrics / item.totalRubrics / item.steps,
      0,
    ) /
      taskCount) *
    100;
  return {
    taskCount,
    totalRubrics,
    passedRubrics,
    rubricAverage: round((passedRubrics / totalRubrics) * 100, 2),
    perfectTasks,
    perfectRate: round((perfectTasks / taskCount) * 100, 2),
    averageSteps: round(averageSteps, 4),
    trajectoryEfficiency: round(trajectoryEfficiency, 4),
  };
}

function validateTaskResults(value, dataset, protocol, run, inputKind) {
  invariant(Array.isArray(value), "task_results must be an array");
  invariant(
    value.length === dataset.length,
    "task_results must contain all " + dataset.length + " tasks",
  );
  const evidenceHashes = new Set([run.evidenceSha256]);
  const normalized = [];
  let previousFinishedMilliseconds = run.started.milliseconds;
  for (let index = 0; index < dataset.length; index += 1) {
    const sourceTask = dataset[index];
    const result = value[index];
    const label = "task_results[" + index + "]";
    exactKeys(
      result,
      [
        "task_id",
        "attempts",
        "steps",
        "started_at",
        "finished_at",
        "evidence_url",
        "evidence_sha256",
        "rubrics",
      ],
      label,
    );
    invariant(
      result.task_id === sourceTask.task_id,
      label + ".task_id must be " + sourceTask.task_id,
    );
    const attempts = boundedInteger(
      result.attempts,
      label + ".attempts",
      1,
      protocol.execution.provider_retry_count + 1,
    );
    const steps = boundedInteger(
      result.steps,
      label + ".steps",
      1,
      MAX_REPORTED_STEPS,
    );
    const started = parseTimestamp(result.started_at, label + ".started_at");
    const finished = parseTimestamp(result.finished_at, label + ".finished_at");
    invariant(
      finished.milliseconds >= started.milliseconds,
      label + ".finished_at must not precede its start",
    );
    invariant(
      finished.milliseconds - started.milliseconds <=
        protocol.execution.task_timeout_seconds * 1_000,
      label + " exceeds the frozen final-attempt timeout",
    );
    invariant(
      started.milliseconds >= run.started.milliseconds &&
        finished.milliseconds <= run.finished.milliseconds,
      label + " timestamps must lie inside the run window",
    );
    invariant(
      started.milliseconds >= previousFinishedMilliseconds,
      label + " overlaps or precedes the prior task despite concurrency=1",
    );
    previousFinishedMilliseconds = finished.milliseconds;
    const evidenceUrl = publicHttpsUrl(
      result.evidence_url,
      label + ".evidence_url",
    );
    const evidenceSha256 = sha256(
      result.evidence_sha256,
      label + ".evidence_sha256",
    );
    invariant(
      !evidenceHashes.has(evidenceSha256),
      label + ".evidence_sha256 must be unique",
    );
    evidenceHashes.add(evidenceSha256);

    invariant(isPlainObject(result.rubrics), label + ".rubrics must be an object");
    const expectedRubricIds = Object.keys(sourceTask.rubrics);
    exactKeys(result.rubrics, expectedRubricIds, label + ".rubrics");
    let passedRubrics = 0;
    const rubricAudit = [];
    for (const rubricId of expectedRubricIds) {
      const decision = result.rubrics[rubricId];
      const rubricLabel = label + ".rubrics." + rubricId;
      exactKeys(
        decision,
        ["satisfied", "confidence", "reasoning", "judge_model"],
        rubricLabel,
      );
      invariant(
        typeof decision.satisfied === "boolean",
        rubricLabel + ".satisfied must be boolean",
      );
      boundedInteger(
        decision.confidence,
        rubricLabel + ".confidence",
        0,
        10,
      );
      nonEmptyString(
        decision.reasoning,
        rubricLabel + ".reasoning",
        MAX_REASONING_LENGTH,
      );
      invariant(
        decision.judge_model === protocol.judge.model,
        rubricLabel + ".judge_model must match the frozen judge model",
      );
      if (decision.satisfied) {
        passedRubrics += 1;
      }
      if (inputKind === "synthetic_fixture") {
        invariant(
          decision.satisfied === false &&
            decision.confidence === 0 &&
            decision.reasoning === SYNTHETIC_REASONING,
          rubricLabel + " must use the fixed synthetic no-run decision",
        );
      } else {
        invariant(
          decision.reasoning !== SYNTHETIC_REASONING,
          rubricLabel + " cannot use the synthetic no-run reasoning",
        );
      }
      rubricAudit.push({
        rubric_id: rubricId,
        satisfied: decision.satisfied,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        judge_model: decision.judge_model,
      });
    }
    normalized.push({
      taskId: sourceTask.task_id,
      level: sourceTask.level,
      attempts,
      steps,
      startedAt: started.text,
      finishedAt: finished.text,
      evidenceUrl,
      evidenceSha256,
      passedRubrics,
      totalRubrics: expectedRubricIds.length,
      rubricAudit,
    });
    if (inputKind === "synthetic_fixture") {
      const expectedSourceUrl =
        protocol.source_snapshot.repository +
        "/blob/" +
        protocol.source_snapshot.commit +
        "/" +
        protocol.source_snapshot.dataset_path;
      const expectedTaskSha = createHash("sha256")
        .update(JSON.stringify(sourceTask))
        .digest("hex");
      invariant(attempts === 1 && steps === 1, label + " synthetic counts are fixed");
      invariant(
        evidenceUrl === expectedSourceUrl &&
          evidenceSha256 === expectedTaskSha,
        label + " synthetic source reference is invalid",
      );
    }
  }
  return normalized;
}

function supplementaryTable(items) {
  const groups = [
    ["overall", items],
    ["low", items.filter((item) => item.level === "low")],
    ["medium", items.filter((item) => item.level === "medium")],
    ["high", items.filter((item) => item.level === "high")],
  ];
  return {
    type: "metric_table",
    id: "rubric-metrics-by-level",
    label: "分层指标",
    title: "Rubric scoring and efficiency by level",
    columns: [
      "Level",
      "Tasks",
      "Rubrics",
      "Passed",
      "Rubric Avg",
      "Perfect %",
      "Avg. Steps",
      "Traj. Eff.",
    ],
    rows: groups.map(([level, group]) => {
      const metrics = groupMetrics(group);
      return {
        cells: [
          level,
          metrics.taskCount,
          metrics.totalRubrics,
          metrics.passedRubrics,
          metrics.rubricAverage,
          metrics.perfectRate,
          metrics.averageSteps,
          metrics.trajectoryEfficiency,
        ],
      };
    }),
    note:
      "Derived: each row is deterministically calculated from this complete envelope using the pinned report formulas. Only overall Rubric Avg ranks a real complete run; all other values are supplementary.",
  };
}

function buildResult(input, dataset, protocol, definition, evalCommit) {
  exactKeys(
    input,
    ["kind", "participant", "protocol", "run", "task_results"],
    "input",
  );
  invariant(
    ["run", "synthetic_fixture"].includes(input.kind),
    "input.kind must be run or synthetic_fixture",
  );
  const participant = validateParticipant(
    input.participant,
    protocol,
    input.kind,
  );
  invariant(
    stableJson(input.protocol) === stableJson(protocol.submission_contract),
    "input.protocol must exactly match tasks/protocol.json submission_contract",
  );
  const run = validateRun(input.run);
  if (input.kind === "synthetic_fixture") {
    const expectedSourceUrl =
      protocol.source_snapshot.repository +
      "/blob/" +
      protocol.source_snapshot.commit +
      "/" +
      protocol.source_snapshot.dataset_path;
    invariant(
      run.evidenceUrl === expectedSourceUrl &&
        run.evidenceSha256 === protocol.source_snapshot.dataset_sha256,
      "synthetic run reference must identify the pinned dataset",
    );
  }
  const taskResults = validateTaskResults(
    input.task_results,
    dataset,
    protocol,
    run,
    input.kind,
  );
  const overall = groupMetrics(taskResults);
  const evidenceFingerprint = createHash("sha256")
    .update(
      [run.evidenceSha256, ...taskResults.map((task) => task.evidenceSha256)].join(
        "\n",
      ),
    )
    .digest("hex");
  const result = {
    eval_id: definition.id,
    submission: {
      kind: "run",
      runner_version: "real-world-bench/pack-to-result@1.1.0",
      run_date: run.started.text.slice(0, 10),
    },
    results: [
      {
        participant: {
          ...participant,
          config: {
            ...participant.config,
            ...(input.kind === "synthetic_fixture"
              ? { fixture_kind: "synthetic_structure_only" }
              : {}),
            protocol_profile: protocol.protocol_profile,
            protocol_revision: protocol.protocol_revision,
            source_repository: protocol.source_snapshot.repository,
            source_commit: protocol.source_snapshot.commit,
            dataset_sha256: protocol.source_snapshot.dataset_sha256,
            resource_manifest_sha256:
              protocol.source_snapshot.resource_manifest_sha256,
            resume_attachment_sha256:
              protocol.source_snapshot.resume_attachment_sha256,
            ticket_rush_source_tree_sha256:
              protocol.source_snapshot.ticket_rush_source_tree_sha256,
            run_id: run.runId,
            run_evidence_url: run.evidenceUrl,
            run_evidence_sha256: run.evidenceSha256,
            evidence_fingerprint: evidenceFingerprint,
            judge_provider: protocol.judge.provider,
            judge_model: protocol.judge.model,
            judge_mode: protocol.judge.mode,
            judge_thinking_level: protocol.judge.thinking_level,
          },
        },
        score: overall.rubricAverage,
        raw_metric: {
          label: "Rubric Avg",
          value:
            overall.passedRubrics +
            " / " +
            overall.totalRubrics +
            " rubrics · " +
            overall.rubricAverage +
            " 分",
        },
        detail:
          input.kind === "synthetic_fixture"
            ? "Derived: synthetic structure fixture only. score = 0 passed rubrics / 154 total rubrics × 100 = 0. No browser run, model output, Judge call, or execution trace exists; URLs and hashes identify pinned source definitions solely to exercise the offline envelope validator. This is not a model result, official baseline, or EvalHub rerun."
            : "Derived: score = " +
              overall.passedRubrics +
              " passed rubrics / " +
              overall.totalRubrics +
              " total rubrics × 100 = " +
              overall.rubricAverage +
              ". This complete envelope contains " +
              overall.taskCount +
              " tasks. The offline packer verified frozen protocol declarations, stable IDs, rubric decisions, final-attempt timeouts, public HTTPS evidence indexes, and SHA-256 fingerprints; it did not fetch artifacts or prove model, trajectory, or Judge authenticity. Author review is still required.",
        task_results: taskResults.map((task) => ({
          task_id: task.taskId,
          score: round(
            (task.passedRubrics / task.totalRubrics) * 100,
            2,
          ),
          raw: JSON.stringify(
            input.kind === "synthetic_fixture"
              ? {
                  synthetic_fixture: true,
                  level: task.level,
                  passed_rubrics: task.passedRubrics,
                  total_rubrics: task.totalRubrics,
                  attempts: task.attempts,
                  steps: task.steps,
                  started_at: task.startedAt,
                  finished_at: task.finishedAt,
                  source_url: task.evidenceUrl,
                  source_task_sha256: task.evidenceSha256,
                  rubric_audit: task.rubricAudit,
                }
              : {
                  level: task.level,
                  passed_rubrics: task.passedRubrics,
                  total_rubrics: task.totalRubrics,
                  attempts: task.attempts,
                  steps: task.steps,
                  started_at: task.startedAt,
                  finished_at: task.finishedAt,
                  evidence_url: task.evidenceUrl,
                  evidence_sha256: task.evidenceSha256,
                  rubric_audit: task.rubricAudit,
                },
          ),
        })),
        supplementary_views: [
          {
            ...supplementaryTable(taskResults),
            ...(input.kind === "synthetic_fixture"
              ? {
                  note:
                    "Derived: each row is deterministically calculated from this synthetic all-false structure fixture using the pinned report formulas. Only overall Rubric Avg would rank a real complete run; these fixture values are not benchmark results.",
                }
              : {}),
          },
        ],
      },
    ],
  };
  if (evalCommit !== undefined) {
    result.eval_commit = evalCommit;
  }
  const generic = ResultFileSchema.safeParse(result);
  invariant(
    generic.success,
    "generated result does not match ResultFileSchema: " +
      (generic.success ? "" : generic.error.message),
  );
  const contextual = validateResultForEval(definition, generic.data);
  invariant(
    contextual.success,
    "generated result is invalid for real-world-bench: " +
      (contextual.success ? "" : contextual.error.message),
  );
  return generic.data;
}

async function atomicWrite(filePath, value) {
  const directory = path.dirname(filePath);
  const temporary = path.join(
    directory,
    "." + path.basename(filePath) + "." + randomUUID() + ".tmp",
  );
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, filePath);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const [{ dataset, protocol }, inputDocument] = await Promise.all([
    loadFrozenInputs(),
    parseJsonFile(arguments_.inputPath, "submission input"),
  ]);
  const definition = buildValidationDefinition(dataset, protocol);
  const result = buildResult(
    inputDocument.value,
    dataset,
    protocol,
    definition,
    arguments_.evalCommit,
  );
  await atomicWrite(arguments_.outputPath, result);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
