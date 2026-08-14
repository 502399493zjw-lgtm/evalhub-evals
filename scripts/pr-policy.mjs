#!/usr/bin/env node

import { appendFile, readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MAINTAINER_LOGIN = "502399493zjw-lgtm";
const MAX_CHANGED_FILES = 3_000;
const MAX_POLICY_FILE_BYTES = 2 * 1024 * 1024;
const AUTHORS_HANDLE_PATTERN =
  /^@[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/u;
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/u;
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "assets",
  "auth",
  "edit",
  "evals",
  "new",
  "settings",
  "submit",
]);
// 必须与平台 evalSubmissionTask.ts 的 marker 正则逐字一致：平台按这个形状认领 PR，
// CI 放宽一个字符，孤儿就会重新变成静默的。
const SUBMISSION_MARKER_PATTERN =
  /<!-- evalhub-submission task=(evaltask_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}) kind=(new|update) slug=([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?) -->/gu;
// 宽松探测：贴了但贴错的 marker，平台会直接匹配不到而静默跳过认领，
// 所以"像 marker 但解析不出来"必须和"完全没贴"区分开报错。
const SUBMISSION_MARKER_ATTEMPT_PATTERN = /<!--\s*evalhub-submission\b/gu;
const MAX_POLICY_BODY_BYTES = 262_144;

export class PullRequestPolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PullRequestPolicyError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new PullRequestPolicyError(code, message);
}

function sameLogin(left, right) {
  return left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US");
}

function scanSubmissionMarker(rawBody) {
  if (rawBody === null || rawBody === undefined) {
    return { marker: null, attempts: 0 };
  }
  if (typeof rawBody !== "string") {
    reject("invalid_pull_request_body", "pull request body must be text or null");
  }
  if (Buffer.byteLength(rawBody, "utf8") > MAX_POLICY_BODY_BYTES) {
    reject(
      "invalid_pull_request_body",
      `pull request body exceeds the ${MAX_POLICY_BODY_BYTES}-byte policy scan limit`,
    );
  }
  const attempts = [...rawBody.matchAll(SUBMISSION_MARKER_ATTEMPT_PATTERN)].length;
  const matches = [...rawBody.matchAll(SUBMISSION_MARKER_PATTERN)];
  if (matches.length > 1) {
    reject(
      "submission_marker_duplicated",
      `pull request body carries ${matches.length} submission markers; the platform binds only the first, so exactly one is allowed`,
    );
  }
  if (matches.length === 0) {
    if (attempts > 0) {
      reject(
        "submission_marker_malformed",
        "pull request body contains a submission marker the platform cannot parse; it must read exactly `<!-- evalhub-submission task=evaltask_<uuid> kind=new|update slug=<slug> -->` with single spaces",
      );
    }
    return { marker: null, attempts };
  }
  if (attempts > 1) {
    reject(
      "submission_marker_malformed",
      "pull request body contains an extra unparseable submission marker alongside the valid one; remove it so the binding is unambiguous",
    );
  }
  const [, taskId, kind, slug] = matches[0];
  return { marker: { taskId, kind, slug }, attempts };
}

function enforceSubmissionMarker(scan, { actor, slug, expectedKind }) {
  const { marker } = scan;
  if (expectedKind === null) {
    if (marker !== null) {
      reject(
        "submission_marker_unexpected",
        `this pull request is not an eval submission, so it must not carry submission marker ${marker.taskId}`,
      );
    }
    return null;
  }
  if (marker === null) {
    // 维护者手写的 PR 允许不走投稿链路；社区投稿必须带 marker，否则 task 会静默孤儿化。
    if (!sameLogin(actor, MAINTAINER_LOGIN)) {
      reject(
        "submission_marker_required",
        `eval submissions must carry the submission marker issued with your EvalHub submission task, otherwise the task can never be published; open this PR through the EvalHub submission flow, or copy \`<!-- evalhub-submission task=<your task id> kind=${expectedKind} slug=${slug} -->\` into the PR description verbatim`,
      );
    }
    return null;
  }
  if (marker.slug !== slug) {
    reject(
      "submission_marker_slug_mismatch",
      `submission marker slug ${JSON.stringify(marker.slug)} does not match the eval changed by this pull request ${JSON.stringify(slug)}`,
    );
  }
  if (marker.kind !== expectedKind) {
    reject(
      "submission_marker_kind_mismatch",
      `submission marker declares kind=${marker.kind}, but this pull request ${expectedKind === "new" ? "creates a new eval" : "updates an existing eval"}, so it must declare kind=${expectedKind}`,
    );
  }
  return marker.taskId;
}

function parseAuthors(contents, source) {
  const meaningful = contents
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (meaningful.length !== 1 || !AUTHORS_HANDLE_PATTERN.test(meaningful[0])) {
    reject(
      "invalid_authors",
      `${source} must contain exactly one GitHub handle`,
    );
  }
  return meaningful[0].slice(1);
}

function parseEvalId(contents, source) {
  const matches = [...contents.matchAll(/^id:\s*([^\s#]+)\s*(?:#.*)?$/gmu)];
  if (matches.length !== 1) {
    reject("invalid_eval_id", `${source} must contain exactly one scalar id`);
  }
  return matches[0][1];
}

function parsePolicyScalar(rawValue, source, key) {
  const value = rawValue.trim();
  if (value.startsWith('"')) {
    let escaped = false;
    let end = -1;
    for (let index = 1; index < value.length; index += 1) {
      if (escaped) {
        escaped = false;
      } else if (value[index] === "\\") {
        escaped = true;
      } else if (value[index] === '"') {
        end = index;
        break;
      }
    }
    if (end > 0 && /^(?:\s+#.*)?$/u.test(value.slice(end + 1))) {
      try {
        const parsed = JSON.parse(value.slice(0, end + 1));
        if (typeof parsed === "string") return parsed;
      } catch {
        // Rejected below as an ambiguous scalar.
      }
    }
  } else if (value.startsWith("'")) {
    let parsed = "";
    let end = -1;
    for (let index = 1; index < value.length; index += 1) {
      if (value[index] !== "'") {
        parsed += value[index];
      } else if (value[index + 1] === "'") {
        parsed += "'";
        index += 1;
      } else {
        end = index;
        break;
      }
    }
    if (end > 0 && /^(?:\s+#.*)?$/u.test(value.slice(end + 1))) {
      return parsed;
    }
  } else {
    const withoutComment = value.replace(/\s+#.*$/u, "").trim();
    if (/^[A-Za-z0-9_-]+$/u.test(withoutComment)) return withoutComment;
  }
  reject(
    "ambiguous_new_eval_yaml",
    `${source} ${key} must be a single plain or quoted scalar`,
  );
}

function scanTopLevelPolicyFields(contents, source) {
  if (contents.includes("\t")) {
    reject(
      "ambiguous_new_eval_yaml",
      `${source} cannot use tabs in a new eval definition`,
    );
  }
  const lines = contents.replace(/^\uFEFF/u, "").split(/\r?\n/gu);
  const fields = new Map();
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (line.trim().length === 0 || line.trimStart().startsWith("#")) continue;
    if (/^\s/u.test(line)) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):(.*)$/u.exec(line);
    if (match === null || fields.has(match[1])) {
      reject(
        "ambiguous_new_eval_yaml",
        `${source} must use unique plain top-level mapping keys`,
      );
    }
    fields.set(match[1], { lineIndex, rawValue: match[2] });
  }
  return { fields, lines };
}

function stripPolicyComment(line, source) {
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;
  let result = "";
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (doubleQuoted) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        doubleQuoted = false;
      }
      continue;
    }
    if (singleQuoted) {
      result += character;
      if (character === "'" && line[index + 1] === "'") {
        result += line[index + 1];
        index += 1;
      } else if (character === "'") {
        singleQuoted = false;
      }
      continue;
    }
    if (character === '"') {
      doubleQuoted = true;
      result += character;
    } else if (character === "'") {
      singleQuoted = true;
      result += character;
    } else if (
      character === "#" &&
      (index === 0 || /\s/u.test(line[index - 1]))
    ) {
      break;
    } else {
      result += character;
    }
  }
  if (singleQuoted || doubleQuoted || escaped) {
    reject(
      "ambiguous_custom_command",
      `${source} command_template cannot use multiline quoted scalars`,
    );
  }
  return result;
}

function validateNewEvalDefinition(contents, source) {
  const { fields, lines } = scanTopLevelPolicyFields(contents, source);
  const runnerField = fields.get("runner");
  if (runnerField === undefined) {
    reject("runner_required", `${source} must explicitly declare runner`);
  }
  const runner = parsePolicyScalar(runnerField.rawValue, source, "runner");
  if (runner !== "builtin" && runner !== "custom") {
    reject("invalid_runner", `${source} runner must be builtin or custom`);
  }
  if (runner !== "custom") return;

  const customModeField = fields.get("custom_mode");
  if (customModeField === undefined) {
    reject(
      "custom_mode_required",
      `${source} must explicitly declare custom_mode for a new custom eval`,
    );
  }
  const customMode = parsePolicyScalar(
    customModeField.rawValue,
    source,
    "custom_mode",
  );
  if (customMode !== "executable" && customMode !== "external_workflow") {
    reject(
      "invalid_custom_mode",
      `${source} custom_mode must be executable or external_workflow`,
    );
  }

  const commandField = fields.get("command_template");
  if (commandField === undefined) return;
  const nextFieldIndex = Math.min(
    ...[...fields.values()]
      .map(({ lineIndex }) => lineIndex)
      .filter((lineIndex) => lineIndex > commandField.lineIndex),
    lines.length,
  );
  const commandText = [
    stripPolicyComment(commandField.rawValue, source),
    ...lines
      .slice(commandField.lineIndex + 1, nextFieldIndex)
      .map((line) => stripPolicyComment(line, source)),
  ].join("\n");
  if (
    commandText.includes("\\") ||
    /(?:^|[\s:[,{])(?:[&*][A-Za-z0-9_-]+|!)/mu.test(commandText)
  ) {
    reject(
      "ambiguous_custom_command",
      `${source} command_template cannot use escapes, YAML anchors, aliases, or tags`,
    );
  }
  if (
    /^\s*(?:-\s*)?(?:[>|](?:[+-][1-9]?|[1-9][+-]?)?|[^\n:]+:\s*[>|](?:[+-][1-9]?|[1-9][+-]?)?)\s*$/mu.test(
      commandText,
    )
  ) {
    reject(
      "ambiguous_custom_command",
      `${source} command_template cannot use multiline scalar syntax`,
    );
  }
  if (/(?:^|[/\s"'[\]{},:])\.\.(?=$|[/\s"'[\]{},:])/mu.test(commandText)) {
    reject(
      "ambiguous_custom_command",
      `${source} command_template cannot use parent-directory path segments`,
    );
  }
  const normalizedCommandText = commandText.replace(/\/+(?:\.\/+)*/gu, "/");
  if (/tasks\/example-/u.test(normalizedCommandText)) {
    reject(
      "example_input_hardcoded",
      `${source} command_template.argv cannot hard-code tasks/example-* fixtures; use {input} with custom_mode=external_workflow for participant input`,
    );
  }
}

function evalPath(pathname) {
  const segments = pathname.split("/");
  if (
    segments.length < 3 ||
    segments[0] !== "evals" ||
    segments[1].length === 0 ||
    segments.slice(2).some((segment) => segment.length === 0)
  ) {
    return null;
  }
  return { slug: segments[1], relativePath: segments.slice(2).join("/") };
}

function validateSlug(slug) {
  if (
    !SLUG_PATTERN.test(slug) ||
    slug.length < 2 ||
    slug.includes("--") ||
    RESERVED_SLUGS.has(slug)
  ) {
    reject(
      "invalid_slug",
      `slug ${JSON.stringify(slug)} does not satisfy the EvalHub slug policy`,
    );
  }
}

function classifyChangedPaths(changedFiles) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    reject("no_changed_files", "pull request has no changed files");
  }
  if (changedFiles.length > MAX_CHANGED_FILES) {
    reject(
      "changed_files_limit_exceeded",
      `pull request changes more than ${MAX_CHANGED_FILES} files`,
    );
  }

  const slugs = new Set();
  let outsideEval = false;
  let authorsChanged = false;

  for (const file of changedFiles) {
    if (!file || typeof file.filename !== "string") {
      reject("invalid_changed_file", "GitHub returned an invalid changed file");
    }

    const current = evalPath(file.filename);
    const previous =
      typeof file.previous_filename === "string"
        ? evalPath(file.previous_filename)
        : null;

    if (
      file.status === "renamed" &&
      previous !== null &&
      current !== null &&
      previous.slug !== current.slug
    ) {
      reject(
        "slug_rename_forbidden",
        `slug rename from ${previous.slug} to ${current.slug} is forbidden`,
      );
    }

    for (const parsed of [current, previous]) {
      if (parsed === null) continue;
      slugs.add(parsed.slug);
      if (parsed.relativePath === "AUTHORS") authorsChanged = true;
    }
    if (current === null || (file.previous_filename && previous === null)) {
      outsideEval = true;
    }
  }

  if (slugs.size > 1) {
    reject(
      "multiple_slugs_changed",
      `pull request changes multiple eval slugs: ${[...slugs].sort().join(", ")}`,
    );
  }
  if (slugs.size === 1 && outsideEval) {
    reject(
      "maintenance_mixed_with_eval",
      "an eval submission cannot include repository maintenance files",
    );
  }

  return {
    authorsChanged,
    outsideEval,
    slug: slugs.size === 1 ? [...slugs][0] : null,
  };
}

async function requiredText(readText, repository, sha, pathname, source) {
  const contents = await readText(repository, sha, pathname);
  if (contents === null) {
    reject("required_file_missing", `${source} is missing`);
  }
  return contents;
}

function parseJsonObject(contents, source) {
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed;
}

function withoutOfficialCoverageMetadata(document) {
  const source = document?.submission?.source;
  if (source === null || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }
  const clone = JSON.parse(JSON.stringify(document));
  delete clone.submission.source.official_result_count;
  delete clone.submission.source.omitted_models;
  return clone;
}

function isOneTimeOfficialCoverageChange(baseContents, headContents, source) {
  const base = parseJsonObject(baseContents, `base:${source}`);
  const head = parseJsonObject(headContents, `head:${source}`);
  if (base === null || head === null) return false;

  const baseSource = base?.submission?.source;
  const headSource = head?.submission?.source;
  if (
    baseSource === null ||
    typeof baseSource !== "object" ||
    Array.isArray(baseSource) ||
    headSource === null ||
    typeof headSource !== "object" ||
    Array.isArray(headSource) ||
    Object.hasOwn(baseSource, "official_result_count") ||
    Object.hasOwn(baseSource, "omitted_models") ||
    !Object.hasOwn(headSource, "official_result_count")
  ) {
    return false;
  }

  const omittedModels = headSource.omitted_models ?? [];
  const results = head.results;
  if (
    !Number.isInteger(headSource.official_result_count) ||
    headSource.official_result_count < 0 ||
    !Array.isArray(omittedModels) ||
    !Array.isArray(results) ||
    headSource.official_result_count !== results.length + omittedModels.length
  ) {
    return false;
  }

  const baseWithoutCoverage = withoutOfficialCoverageMetadata(base);
  const headWithoutCoverage = withoutOfficialCoverageMetadata(head);
  return (
    baseWithoutCoverage !== null &&
    headWithoutCoverage !== null &&
    JSON.stringify(baseWithoutCoverage) === JSON.stringify(headWithoutCoverage)
  );
}

async function isMaintainerOfficialCoverageMigration({
  actor,
  slug,
  changedFiles,
  readText,
  baseRepository,
  baseSha,
  headRepository,
  headSha,
}) {
  if (!sameLogin(actor, MAINTAINER_LOGIN)) return false;

  const prefix = `evals/${slug}/published-results/`;
  if (
    changedFiles.length === 0 ||
    changedFiles.some((file) =>
      file.status !== "modified" ||
      typeof file.filename !== "string" ||
      !file.filename.startsWith(prefix) ||
      !file.filename.endsWith(".json") ||
      typeof file.previous_filename === "string"
    )
  ) {
    return false;
  }

  for (const file of changedFiles) {
    const [baseContents, headContents] = await Promise.all([
      readText(baseRepository, baseSha, file.filename),
      readText(headRepository, headSha, file.filename),
    ]);
    if (
      baseContents === null ||
      headContents === null ||
      !isOneTimeOfficialCoverageChange(baseContents, headContents, file.filename)
    ) {
      return false;
    }
  }
  return true;
}

const GITHUB_OWNER_PATTERN =
  /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,38})$/u;
const GITHUB_REPOSITORY_PATTERN =
  /^([A-Za-z0-9](?:[A-Za-z0-9_.-]{0,38}))\/([A-Za-z0-9_.-]{1,100})$/u;

function parseSourceScalar(rawValue, source, key) {
  const value = rawValue.trim();
  if (value.startsWith('"')) {
    let escaped = false;
    let end = -1;
    for (let index = 1; index < value.length; index += 1) {
      if (escaped) {
        escaped = false;
      } else if (value[index] === "\\") {
        escaped = true;
      } else if (value[index] === '"') {
        end = index;
        break;
      }
    }
    if (end > 0 && /^(?:\s+#.*)?$/u.test(value.slice(end + 1))) {
      try {
        const parsed = JSON.parse(value.slice(0, end + 1));
        if (typeof parsed === "string") return parsed;
      } catch {
        // Rejected below as an invalid source declaration.
      }
    }
  } else if (value.startsWith("'")) {
    const end = value.indexOf("'", 1);
    if (end > 0 && /^(?:\s+#.*)?$/u.test(value.slice(end + 1))) {
      return value.slice(1, end).replaceAll("''", "'");
    }
  } else {
    const withoutComment = value.replace(/\s+#.*$/u, "").trim();
    if (withoutComment.length > 0 && !/[\u0000-\u001f\u007f]/u.test(withoutComment)) {
      return withoutComment;
    }
  }
  reject(
    "source_owner_unavailable",
    `${source} ${key} must be a single source scalar`,
  );
}

function readNestedScalar(contents, section, key, source) {
  const lines = contents.replace(/^\uFEFF/u, "").split(/\r?\n/gu);
  let inSection = false;
  let value = null;
  for (const line of lines) {
    if (/^\S/u.test(line)) {
      const sectionMatch = new RegExp(`^${section}:\\s*(?:#.*)?$`, "u").test(line);
      inSection = sectionMatch;
      continue;
    }
    if (!inSection || !/^\s+\S/u.test(line) || line.trimStart().startsWith("#")) {
      continue;
    }
    const match = new RegExp(`^\\s+${key}:\\s*(.*)$`, "u").exec(line);
    if (match === null) continue;
    if (value !== null) {
      reject(
        "source_owner_unavailable",
        `${source} ${key} must be declared at most once`,
      );
    }
    value = parseSourceScalar(match[1], source, key);
  }
  return value;
}

function parseGitHubRepositoryOwner(repository, source) {
  const match = GITHUB_REPOSITORY_PATTERN.exec(repository.trim());
  if (match === null || !GITHUB_OWNER_PATTERN.test(match[1])) {
    reject(
      "source_owner_unavailable",
      `${source} must be a GitHub repository in owner/name format`,
    );
  }
  return match[1];
}

function parseGitHubRepositoryUrl(repository, source) {
  const value = repository.trim();
  const match = /^https:\/\/github\.com\/([^/?#]+)\/([^/?#]+)\/?$/u.exec(value);
  if (match === null || !GITHUB_OWNER_PATTERN.test(match[1])) {
    reject(
      "source_owner_unavailable",
      `${source} must be a repository homepage in the exact https://github.com/owner/name format`,
    );
  }
  return match[1];
}

function resolveSourceOwner(contents, nativeRepository, source) {
  const upstreamRepository = readNestedScalar(contents, "upstream", "repo", source);
  if (upstreamRepository !== null) {
    return parseGitHubRepositoryOwner(upstreamRepository, `${source} upstream.repo`);
  }
  const referenceRepository = readNestedScalar(
    contents,
    "references",
    "repository",
    source,
  );
  if (referenceRepository !== null) {
    return parseGitHubRepositoryUrl(
      referenceRepository,
      `${source} references.repository`,
    );
  }
  return parseGitHubRepositoryOwner(nativeRepository, `${source} native repository`);
}

export function resolveEvalSourceOwnerHandle({
  evalYaml,
  nativeRepository,
  source = "eval.yaml",
}) {
  if (typeof evalYaml !== "string") {
    reject("source_owner_unavailable", `${source} must be text`);
  }
  return resolveSourceOwner(evalYaml, nativeRepository, source);
}

export async function evaluatePullRequestPolicy({
  event,
  listChangedFiles,
  readText,
}) {
  const pullRequest = event?.pull_request;
  if (!pullRequest) {
    reject("invalid_event", "event is not a pull_request event");
  }
  if (pullRequest.base?.ref !== "main") {
    reject("invalid_base_branch", "pull request must target main");
  }

  const actor = pullRequest.user?.login;
  const actorId = pullRequest.user?.id;
  const baseRepository = pullRequest.base?.repo?.full_name;
  const baseSha = pullRequest.base?.sha;
  const headRepository = pullRequest.head?.repo?.full_name;
  const headSha = pullRequest.head?.sha;
  if (
    typeof actor !== "string" ||
    !Number.isInteger(actorId) ||
    typeof baseRepository !== "string" ||
    typeof baseSha !== "string" ||
    typeof headRepository !== "string" ||
    typeof headSha !== "string"
  ) {
    reject("invalid_event", "pull request identity or repository data is incomplete");
  }

  const changedFiles = await listChangedFiles();
  const changed = classifyChangedPaths(changedFiles);
  const markerScan = scanSubmissionMarker(pullRequest.body);
  const audit = {
    actor,
    actorId,
    baseSha,
    headSha,
    changedFileCount: changedFiles.length,
  };

  if (changed.slug === null) {
    if (!changed.outsideEval) {
      reject("invalid_changed_paths", "unable to classify changed files");
    }
    if (!sameLogin(actor, MAINTAINER_LOGIN)) {
      reject(
        "maintenance_actor_required",
        `repository maintenance PRs may only be opened by @${MAINTAINER_LOGIN}`,
      );
    }
    enforceSubmissionMarker(markerScan, {
      actor,
      slug: null,
      expectedKind: null,
    });
    return {
      ...audit,
      mode: "maintenance",
      owner: MAINTAINER_LOGIN,
      submissionTask: null,
    };
  }

  const slug = changed.slug;
  validateSlug(slug);
  const evalYamlPath = `evals/${slug}/eval.yaml`;
  const authorsPath = `evals/${slug}/AUTHORS`;
  const [baseEvalYaml, headEvalYaml] = await Promise.all([
    readText(baseRepository, baseSha, evalYamlPath),
    readText(headRepository, headSha, evalYamlPath),
  ]);

  if (baseEvalYaml === null) {
    if (headEvalYaml === null) {
      reject("required_file_missing", `${evalYamlPath} is missing from the PR head`);
    }
    const headId = parseEvalId(headEvalYaml, `head:${evalYamlPath}`);
    if (headId !== slug) {
      reject(
        "eval_id_mismatch",
        `head eval id ${JSON.stringify(headId)} does not equal slug ${JSON.stringify(slug)}`,
      );
    }
    const headAuthors = await requiredText(
      readText,
      headRepository,
      headSha,
      authorsPath,
      `head:${authorsPath}`,
    );
    const maintainer = parseAuthors(headAuthors, `head:${authorsPath}`);
    if (!sameLogin(actor, maintainer)) {
      reject(
        "author_mismatch",
        `new eval AUTHORS @${maintainer} must match PR creator @${actor}`,
      );
    }
    const sourceOwner = resolveEvalSourceOwnerHandle({
      evalYaml: headEvalYaml,
      nativeRepository: baseRepository,
      source: `head:${evalYamlPath}`,
    });
    validateNewEvalDefinition(headEvalYaml, `head:${evalYamlPath}`);
    const submissionTask = enforceSubmissionMarker(markerScan, {
      actor,
      slug,
      expectedKind: "new",
    });
    return {
      ...audit,
      mode: "community-eval-create",
      owner: sourceOwner,
      maintainer,
      slug,
      submissionTask,
    };
  }

  if (headEvalYaml === null) {
    reject(
      "eval_delete_forbidden",
      `deleting eval ${slug} is not part of the submission/update flow`,
    );
  }

  const [baseAuthors, headAuthors] = await Promise.all([
    requiredText(readText, baseRepository, baseSha, authorsPath, `base:${authorsPath}`),
    requiredText(readText, headRepository, headSha, authorsPath, `head:${authorsPath}`),
  ]);
  const baseMaintainer = parseAuthors(baseAuthors, `base:${authorsPath}`);
  if (headAuthors !== baseAuthors) {
    reject(
      "author_change_forbidden",
      `AUTHORS for existing eval ${slug} must remain byte-for-byte identical to base`,
    );
  }

  const baseId = parseEvalId(baseEvalYaml, `base:${evalYamlPath}`);
  if (baseId !== slug) {
    reject(
      "base_eval_id_mismatch",
      `base eval id ${JSON.stringify(baseId)} does not equal slug ${JSON.stringify(slug)}`,
    );
  }
  const headId = parseEvalId(headEvalYaml, `head:${evalYamlPath}`);
  if (headId !== slug) {
    reject(
      "eval_id_mismatch",
      `head eval id ${JSON.stringify(headId)} does not equal slug ${JSON.stringify(slug)}`,
    );
  }

  const baseSourceOwner = resolveEvalSourceOwnerHandle({
    evalYaml: baseEvalYaml,
    nativeRepository: baseRepository,
    source: `base:${evalYamlPath}`,
  });
  const headSourceOwner = resolveEvalSourceOwnerHandle({
    evalYaml: headEvalYaml,
    nativeRepository: baseRepository,
    source: `head:${evalYamlPath}`,
  });
  const authorizedCommunityUpdate =
    sameLogin(actor, baseSourceOwner) || sameLogin(actor, baseMaintainer);
  const maintainerCoverageMigration = authorizedCommunityUpdate
    ? false
    : await isMaintainerOfficialCoverageMigration({
        actor,
        slug,
        changedFiles,
        readText,
        baseRepository,
        baseSha,
        headRepository,
        headSha,
      });
  if (!authorizedCommunityUpdate && !maintainerCoverageMigration) {
    reject(
      "third_party_update_forbidden",
      `@${actor} cannot update eval ${slug}; update access belongs to public author @${baseSourceOwner} or maintainer @${baseMaintainer}`,
    );
  }
  const submissionTask = enforceSubmissionMarker(markerScan, {
    actor,
    slug,
    expectedKind: "update",
  });
  return {
    ...audit,
    mode: maintainerCoverageMigration
      ? "maintainer-official-coverage-migration"
      : "community-eval-update",
    owner: headSourceOwner,
    baseOwner: baseSourceOwner,
    maintainer: baseMaintainer,
    slug,
    submissionTask,
  };
}

function githubClient(token) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "evalhub-pr-policy",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  async function request(pathname) {
    const response = await fetch(`https://api.github.com${pathname}`, { headers });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status} for ${pathname}`);
    }
    return response.json();
  }

  return {
    async listChangedFiles(repository, pullNumber) {
      const files = [];
      for (let page = 1; page <= 30; page += 1) {
        const batch = await request(
          `/repos/${repository}/pulls/${pullNumber}/files?per_page=100&page=${page}`,
        );
        if (!Array.isArray(batch)) {
          throw new Error("GitHub changed-files response is invalid");
        }
        files.push(...batch);
        if (files.length > MAX_CHANGED_FILES) {
          reject(
            "changed_files_limit_exceeded",
            `pull request changes more than ${MAX_CHANGED_FILES} files`,
          );
        }
        if (batch.length < 100) return files;
      }
      reject(
        "changed_files_limit_exceeded",
        `pull request changes at least ${MAX_CHANGED_FILES} files`,
      );
    },

    async readText(repository, sha, pathname) {
      const result = await request(
        `/repos/${repository}/contents/${pathname
          .split("/")
          .map(encodeURIComponent)
          .join("/")}?ref=${encodeURIComponent(sha)}`,
      );
      if (result === null) return null;
      if (
        result.type !== "file" ||
        result.encoding !== "base64" ||
        typeof result.content !== "string" ||
        !Number.isInteger(result.size) ||
        result.size > MAX_POLICY_FILE_BYTES
      ) {
        reject("invalid_policy_file", `${pathname} is not a bounded regular file`);
      }
      const bytes = Buffer.from(result.content.replaceAll("\n", ""), "base64");
      if (bytes.length !== result.size || bytes.includes(0)) {
        reject("invalid_policy_file", `${pathname} is not valid bounded text`);
      }
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return text;
    },
  };
}

function workflowEscape(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const token = process.env.GITHUB_TOKEN;
  if (!eventPath || !token) {
    throw new Error("GITHUB_EVENT_PATH and GITHUB_TOKEN are required");
  }
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const pullRequest = event.pull_request;
  const repository = pullRequest?.base?.repo?.full_name;
  const pullNumber = pullRequest?.number;
  if (typeof repository !== "string" || !Number.isInteger(pullNumber)) {
    reject("invalid_event", "pull request repository or number is missing");
  }
  const client = githubClient(token);
  const result = await evaluatePullRequestPolicy({
    event,
    listChangedFiles: () => client.listChangedFiles(repository, pullNumber),
    readText: client.readText,
  });
  const summary = [
    "## EvalHub PR policy",
    "",
    `- Mode: \`${result.mode}\``,
    `- Actor: \`@${result.actor}\` (GitHub user ID \`${result.actorId}\`)`,
    `- Changed files: \`${result.changedFileCount}\``,
    ...(result.slug ? [`- Slug: \`${result.slug}\``, `- Owner: \`@${result.owner}\``] : []),
    ...(result.submissionTask
      ? [`- Submission task: \`${result.submissionTask}\``]
      : []),
    `- Head SHA: \`${result.headSha}\``,
    "",
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isEntryPoint =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntryPoint) {
  main().catch((error) => {
    const code =
      error instanceof PullRequestPolicyError ? error.code : "policy_internal_error";
    process.stderr.write(
      `::error title=${workflowEscape(code)}::${workflowEscape(error.message)}\n`,
    );
    process.stderr.write(`[${code}] ${error.message}\n`);
    process.exitCode = 1;
  });
}
