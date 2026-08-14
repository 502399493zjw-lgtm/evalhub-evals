#!/usr/bin/env node

import {
  EvalDefSchema,
  ResultFileSchema,
  parseEvalMaintainerText,
  validateResultForEval,
} from "@evalhub/schemas";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseDocument } from "yaml";

import {
  validateEvalContent,
  validateNoGitlinks,
} from "./content-security.mjs";
import {
  buildModelIndex,
  checkModelStrings,
  loadModelRegistry,
} from "./model-contract.mjs";
import { vendorEvalhubModels } from "./vendor-evalhub-models.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, "..");

const REQUIRED_FILES = [
  "eval.yaml",
  "README.md",
  "AUTHORS",
  "sample-result.json",
];
const REQUIRED_DIRECTORIES = ["tasks", "assets"];
const MAINTAINER_HANDLE = "@502399493zjw-lgtm";
const PUBLISHED_RESULT_FILE_MAX_BYTES = 1_048_576;
const PUBLISHED_RESULTS_TOTAL_MAX_BYTES = 8_388_608;
const PUBLISHED_RESULTS_MAX_FILES = 32;

function codeownersSegmentMatches(pattern, value) {
  let source = "^";
  for (const character of pattern) {
    if (character === "*") {
      source += ".*";
    } else if (character === "?") {
      source += ".";
    } else {
      source += "\\^$.*+?()[]{}|".includes(character)
        ? `\\${character}`
        : character;
    }
  }
  return new RegExp(`${source}$`, "u").test(value);
}

function codeownersPathMatches(
  patternSegments,
  pathSegments,
  patternIndex = 0,
  pathIndex = 0,
) {
  if (patternIndex === patternSegments.length) {
    return pathIndex === pathSegments.length;
  }

  const patternSegment = patternSegments[patternIndex];
  if (patternSegment === "**") {
    return (
      codeownersPathMatches(
        patternSegments,
        pathSegments,
        patternIndex + 1,
        pathIndex,
      ) ||
      (pathIndex < pathSegments.length &&
        codeownersPathMatches(
          patternSegments,
          pathSegments,
          patternIndex,
          pathIndex + 1,
        ))
    );
  }

  return (
    pathIndex < pathSegments.length &&
    codeownersSegmentMatches(patternSegment, pathSegments[pathIndex]) &&
    codeownersPathMatches(
      patternSegments,
      pathSegments,
      patternIndex + 1,
      pathIndex + 1,
    )
  );
}

function codeownersPatternMatchesPath(pattern, pathSegments) {
  if (
    pattern === undefined ||
    pattern.startsWith("!") ||
    pattern.includes("[") ||
    pattern.includes("]")
  ) {
    return false;
  }

  if (!pattern.includes("/")) {
    return pathSegments.some((segment) =>
      codeownersSegmentMatches(pattern, segment),
    );
  }

  const normalized = pattern.replace(/^\/+|\/+$/gu, "");
  if (normalized.length === 0) {
    return false;
  }
  const patternSegments = normalized.split("/");

  // CODEOWNERS inherits gitignore's directory behavior: a rule that matches
  // an ancestor directory also owns its descendants.
  return pathSegments.some((_segment, index) =>
    codeownersPathMatches(
      patternSegments,
      pathSegments.slice(0, index + 1),
    ),
  );
}

function effectiveCodeownerForPath(entries, pathSegments) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (
      entry.tokenCountValid &&
      codeownersPatternMatchesPath(entry.pattern, pathSegments)
    ) {
      return entry;
    }
  }
  return null;
}

function effectiveCodeownerForEval(entries, dirName) {
  return effectiveCodeownerForPath(entries, ["evals", dirName]);
}

export class RepositoryValidationError extends Error {
  constructor(errors) {
    super(
      `Validation failed with ${errors.length} error(s):\n\n${errors.join("\n\n")}`,
    );
    this.name = "RepositoryValidationError";
    this.errors = errors;
  }
}

function formatIssues(error) {
  return error.issues
    .map((issue) => {
      const at = issue.path.length ? issue.path.join(".") : "<root>";
      return `${at}: ${issue.message}`;
    })
    .join("\n");
}

function fileError(filePath, message) {
  return `${filePath}\n${message}`;
}

async function inspectRequiredPath(evalDir, relativePath, expectedType) {
  const target = path.join(evalDir, relativePath);
  let metadata;
  try {
    metadata = await lstat(target);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return {
        valid: false,
        error: fileError(target, `${relativePath}: required path is missing`),
      };
    }
    return {
      valid: false,
      error: fileError(
        target,
        `${relativePath}: unable to inspect required path: ${error.message}`,
      ),
    };
  }

  if (expectedType === "directory") {
    if (!metadata.isDirectory()) {
      return {
        valid: false,
        error: fileError(
          target,
          `${relativePath}: required path must be a directory`,
        ),
      };
    }
    return { valid: true };
  }

  if (!metadata.isFile()) {
    return {
      valid: false,
      error: fileError(target, `${relativePath}: required path must be a file`),
    };
  }

  try {
    const content = await readFile(target, "utf8");
    if (content.trim().length === 0) {
      return {
        valid: false,
        error: fileError(
          target,
          `${relativePath}: required file must be non-empty`,
        ),
      };
    }
  } catch (error) {
    return {
      valid: false,
      error: fileError(
        target,
        `${relativePath}: unable to read required file: ${error.message}`,
      ),
    };
  }

  return { valid: true };
}

async function loadCodeowners(repositoryRoot) {
  const filePath = path.join(repositoryRoot, ".github", "CODEOWNERS");
  let metadata;
  try {
    metadata = await lstat(filePath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return {
        available: false,
        filePath,
        entries: [],
        errors: [
          fileError(
            filePath,
            ".github/CODEOWNERS: required path is missing",
          ),
        ],
      };
    }
    return {
      available: false,
      filePath,
      entries: [],
      errors: [
        fileError(
          filePath,
          `.github/CODEOWNERS: unable to inspect required path: ${error.message}`,
        ),
      ],
    };
  }

  if (!metadata.isFile()) {
    return {
      available: false,
      filePath,
      entries: [],
      errors: [
        fileError(
          filePath,
          ".github/CODEOWNERS: required path must be a file",
        ),
      ],
    };
  }

  let source;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    return {
      available: false,
      filePath,
      entries: [],
      errors: [
        fileError(
          filePath,
          `.github/CODEOWNERS: unable to read required file: ${error.message}`,
        ),
      ],
    };
  }

  if (source.trim().length === 0) {
    return {
      available: false,
      filePath,
      entries: [],
      errors: [
        fileError(
          filePath,
          ".github/CODEOWNERS: required file must be non-empty",
        ),
      ],
    };
  }

  const entries = [];
  const errors = [];
  for (const [index, rawLine] of source.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const lineNumber = index + 1;
    const tokens = line.split(/\s+/u);
    const [pattern, owner] = tokens;
    if (tokens.length !== 2) {
      errors.push(
        fileError(
          filePath,
          `line ${lineNumber}: expected exactly two tokens (pattern and one owner)`,
        ),
      );
    }

    entries.push({
      lineNumber,
      pattern,
      owner,
      tokenCountValid: tokens.length === 2,
    });
  }

  return { available: true, filePath, entries, errors };
}

async function readAuthorHandle(evalDir, authorsAvailable, errors) {
  if (!authorsAvailable) {
    return null;
  }

  const authorsPath = path.join(evalDir, "AUTHORS");
  let source;
  try {
    source = await readFile(authorsPath, "utf8");
  } catch (error) {
    errors.push(
      fileError(
        authorsPath,
        `AUTHORS: unable to read ownership handle: ${error.message}`,
      ),
    );
    return null;
  }

  const parsed = parseEvalMaintainerText(source);
  if (!parsed.success) {
    errors.push(
      fileError(
        authorsPath,
        `AUTHORS: ${parsed.message}`,
      ),
    );
    return null;
  }

  return `@${parsed.handle}`;
}

function validateCodeownerForEval(
  codeowners,
  dirName,
  evalFilePaths,
  errors,
) {
  if (!codeowners.available) {
    return;
  }

  const effectiveMatch = effectiveCodeownerForEval(codeowners.entries, dirName);
  if (effectiveMatch === null || effectiveMatch.owner !== MAINTAINER_HANDLE) {
    errors.push(
      fileError(
        codeowners.filePath,
        `/evals/${dirName}/: effective CODEOWNER must be ${MAINTAINER_HANDLE}`,
      ),
    );
  }

  for (const repositoryPath of evalFilePaths) {
    const effectiveFileMatch = effectiveCodeownerForPath(
      codeowners.entries,
      repositoryPath,
    );
    if (
      effectiveFileMatch === null ||
      effectiveFileMatch.owner !== MAINTAINER_HANDLE
    ) {
      errors.push(
        fileError(
          codeowners.filePath,
          `${repositoryPath.join("/")}: effective CODEOWNER must be ${MAINTAINER_HANDLE}`,
        ),
      );
    }
  }
}

async function listEvalFilePaths(repositoryRoot, evalDir) {
  const files = [];

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
      } else {
        files.push(path.relative(repositoryRoot, entryPath).split(path.sep));
      }
    }
  }

  await visit(evalDir);
  return files;
}

async function listEvalDirectories(evalsDir) {
  let entries;
  try {
    entries = await readdir(evalsDir, { withFileTypes: true });
  } catch (error) {
    throw new RepositoryValidationError([
      fileError(evalsDir, `evals: unable to read directory: ${error.message}`),
    ]);
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function parseYamlFile(filePath) {
  const source = await readFile(filePath, "utf8");
  const document = parseDocument(source, {
    prettyErrors: false,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join("\n"));
  }
  return document.toJS();
}

function supplementaryViewContract(view) {
  if (view.type === "metric_table") {
    return JSON.stringify({
      type: view.type,
      title: view.title,
      label: view.label,
      columns: view.columns,
    });
  }
  return JSON.stringify({
    type: view.type,
    title: view.title,
    label: view.label,
    x_label: view.x_label,
    y_label: view.y_label,
  });
}

function validatePublishedSupplementaryContracts(
  resultDocument,
  filePath,
  contracts,
  errors,
) {
  for (const [resultIndex, result] of resultDocument.results.entries()) {
    for (const [viewIndex, view] of (result.supplementary_views ?? []).entries()) {
      if (view.id === undefined) {
        continue;
      }
      const issuePath =
        `results.${resultIndex}.supplementary_views.${viewIndex}.id`;
      const contract = supplementaryViewContract(view);
      const existing = contracts.get(view.id);
      if (existing === undefined) {
        contracts.set(view.id, { contract, filePath, issuePath });
        continue;
      }
      if (existing.contract !== contract) {
        errors.push(
          fileError(
            filePath,
            `${issuePath}: supplementary view "${view.id}" must keep the same type, title, label, and columns or axis labels across every published participant; first defined at ${existing.filePath} (${existing.issuePath})`,
          ),
        );
      }
    }
  }
}

async function validatePublishedResults(
  evalDir,
  parsedEval,
  errors,
  modelIndex = null,
) {
  const directory = path.join(evalDir, "published-results");
  let directoryMetadata;
  try {
    directoryMetadata = await lstat(directory);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      if (parsedEval.baseline_policy === "required") {
        errors.push(
          fileError(
            directory,
            "baseline_policy=required requires at least one published-results/*.json file",
          ),
        );
      }
      return;
    }
    errors.push(
      fileError(directory, `unable to inspect directory: ${error.message}`),
    );
    return;
  }
  if (directoryMetadata.isSymbolicLink() || !directoryMetadata.isDirectory()) {
    errors.push(
      fileError(
        directory,
        "published-results must be a regular directory and cannot be a symbolic link",
      ),
    );
    return;
  }

  let resolvedDirectory;
  try {
    const [resolvedEvalDir, publishedResultsDir] = await Promise.all([
      realpath(evalDir),
      realpath(directory),
    ]);
    if (publishedResultsDir !== path.join(resolvedEvalDir, "published-results")) {
      errors.push(
        fileError(
          directory,
          "published-results directory escapes its eval directory",
        ),
      );
      return;
    }
    resolvedDirectory = publishedResultsDir;
  } catch (error) {
    errors.push(
      fileError(
        directory,
        `unable to safely resolve directory: ${error.message}`,
      ),
    );
    return;
  }

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    errors.push(fileError(directory, `unable to read directory: ${error.message}`));
    return;
  }

  if (entries.length > PUBLISHED_RESULTS_MAX_FILES) {
    errors.push(
      fileError(
        directory,
        `published-results accepts at most ${PUBLISHED_RESULTS_MAX_FILES} JSON files`,
      ),
    );
  }

  const files = [];
  let totalSize = 0;
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/u.test(entry.name)) {
      errors.push(
        fileError(
          path.join(directory, entry.name),
          "published-results only accepts flat, visible .json files",
        ),
      );
      continue;
    }

    const filePath = path.join(directory, entry.name);
    let metadata;
    try {
      metadata = await lstat(filePath);
    } catch (error) {
      errors.push(
        fileError(filePath, `unable to inspect published result: ${error.message}`),
      );
      continue;
    }
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      errors.push(
        fileError(
          filePath,
          "published-results only accepts regular files and does not allow symbolic links",
        ),
      );
      continue;
    }
    if (metadata.size > PUBLISHED_RESULT_FILE_MAX_BYTES) {
      errors.push(
        fileError(
          filePath,
          `published result exceeds ${PUBLISHED_RESULT_FILE_MAX_BYTES} bytes`,
        ),
      );
      continue;
    }
    totalSize += metadata.size;
    if (totalSize > PUBLISHED_RESULTS_TOTAL_MAX_BYTES) {
      errors.push(
        fileError(
          directory,
          `published-results exceeds ${PUBLISHED_RESULTS_TOTAL_MAX_BYTES} bytes in total`,
        ),
      );
      continue;
    }

    try {
      const resolvedFile = await realpath(filePath);
      if (path.dirname(resolvedFile) !== resolvedDirectory) {
        errors.push(
          fileError(filePath, "published result escapes its directory"),
        );
        continue;
      }
    } catch (error) {
      errors.push(
        fileError(filePath, `unable to safely resolve published result: ${error.message}`),
      );
      continue;
    }
    files.push(entry.name);
  }
  if (parsedEval.baseline_policy === "required" && files.length === 0) {
    errors.push(
      fileError(
        directory,
        "baseline_policy=required requires at least one published-results/*.json file",
      ),
    );
  }

  const supplementaryContracts = new Map();
  const officialSources = new Map();
  for (const name of files.sort()) {
    const filePath = path.join(directory, name);
    try {
      const document = JSON.parse(await readFile(filePath, "utf8"));
      const generic = ResultFileSchema.safeParse(document);
      if (!generic.success) {
        errors.push(fileError(filePath, formatIssues(generic.error)));
        continue;
      }
      if (generic.data.eval_commit !== undefined) {
        errors.push(
          fileError(
            filePath,
            "published result must omit eval_commit; the platform binds the merged eval commit",
          ),
        );
      }
      if (generic.data.submission.kind !== "upstream_author_publication") {
        errors.push(
          fileError(
            filePath,
            "published result submission.kind must be upstream_author_publication",
          ),
        );
      }
      const officialSource = generic.data.submission.source;
      if (officialSource !== undefined) {
        const sourceKey = JSON.stringify([
          officialSource.url,
          officialSource.snapshot_sha256,
        ]);
        const firstFile = officialSources.get(sourceKey);
        if (firstFile === undefined) {
          officialSources.set(sourceKey, filePath);
        } else {
          errors.push(
            fileError(
              directory,
              `published-results cannot contain the same official source in multiple JSON files: ${firstFile} and ${filePath} share source.url + snapshot_sha256`,
            ),
          );
        }
      }
      validatePublishedSupplementaryContracts(
        generic.data,
        filePath,
        supplementaryContracts,
        errors,
      );
      const contextual = validateResultForEval(
        parsedEval,
        generic.data,
        { requireOfficialResultCount: true },
      );
      if (!contextual.success) {
        errors.push(fileError(filePath, formatIssues(contextual.error)));
      }
      // 平台导入时解析不了的 participant.model 会让这份成绩被跳过，进而让整批
      // 内容同步以 partial_sync 打回。在 PR 阶段就拦住，而不是等 push 到 main
      // 之后在 webhook 里炸开（2026-08-07 事故的形态）。
      if (modelIndex !== null) {
        for (const failure of checkModelStrings(
          (generic.data.results ?? []).map((result, position) => ({
            model: result?.participant?.model,
            location: `results[${position}].participant.model`,
          })),
          modelIndex,
        )) {
          errors.push(
            fileError(filePath, `${failure.location}: ${failure.reason}`),
          );
        }
      }
    } catch (error) {
      errors.push(fileError(filePath, error.message));
    }
  }
}

/**
 * 快照有两个用途，来源刻意分开：
 * - 判定用 validator 自己旁边那份（社区 PR 的 CI 跑的是 base 分支的 validator，
 *   所以数据也来自 base）。被审目录里的快照绝不参与判定 —— 否则一个 PR 自带
 *   一份写了任意 alias 的 registry.json 就能把自己放过。
 * - 完整性检查针对被审的那棵树：手改快照必须在 PR 阶段就报出来，而不是等它合进
 *   main 之后让后续投稿以为某个拼写是合法的。
 */
async function loadModelIndexForValidation(root, errors) {
  const reviewedSnapshot = path.join(
    root,
    "vendor/evalhub-models/registry.json",
  );
  try {
    await vendorEvalhubModels({ check: true, output: reviewedSnapshot });
  } catch (error) {
    errors.push(fileError(reviewedSnapshot, error.message));
  }
  try {
    return buildModelIndex(await loadModelRegistry());
  } catch (error) {
    errors.push(
      fileError("vendor/evalhub-models/registry.json", error.message),
    );
    return null;
  }
}

export async function validateRepository(repositoryRoot = defaultRoot) {
  const root = path.resolve(repositoryRoot);
  const evalsDir = path.join(root, "evals");
  const errors = [];
  const evalIds = [];
  const seenIds = new Set();
  const evalDirectories = await listEvalDirectories(evalsDir);
  const codeowners = await loadCodeowners(root);
  errors.push(...codeowners.errors);
  const gitlinkProblems = await validateNoGitlinks(root);
  errors.push(
    ...gitlinkProblems.map(({ filePath, message }) => fileError(filePath, message)),
  );
  const modelIndex = await loadModelIndexForValidation(root, errors);

  for (const dirName of evalDirectories) {
    const evalDir = path.join(evalsDir, dirName);
    const requiredStatus = new Map();
    let evalFilePaths = [];

    for (const requiredFile of REQUIRED_FILES) {
      const status = await inspectRequiredPath(evalDir, requiredFile, "file");
      requiredStatus.set(requiredFile, status.valid);
      if (!status.valid) {
        errors.push(status.error);
      }
    }
    for (const requiredDirectory of REQUIRED_DIRECTORIES) {
      const status = await inspectRequiredPath(
        evalDir,
        requiredDirectory,
        "directory",
      );
      requiredStatus.set(requiredDirectory, status.valid);
      if (!status.valid) {
        errors.push(status.error);
      }
    }

    try {
      evalFilePaths = await listEvalFilePaths(root, evalDir);
    } catch (error) {
      errors.push(
        fileError(
          evalDir,
          `eval directory: unable to enumerate owned files: ${error.message}`,
        ),
      );
    }

    await readAuthorHandle(
      evalDir,
      requiredStatus.get("AUTHORS") === true,
      errors,
    );
    validateCodeownerForEval(
      codeowners,
      dirName,
      evalFilePaths,
      errors,
    );

    if (!requiredStatus.get("eval.yaml")) {
      continue;
    }

    const yamlPath = path.join(evalDir, "eval.yaml");
    let parsedEval;
    try {
      const evalDocument = await parseYamlFile(yamlPath);
      const validation = EvalDefSchema.safeParse(evalDocument);
      if (!validation.success) {
        errors.push(fileError(yamlPath, formatIssues(validation.error)));
        continue;
      }
      parsedEval = validation.data;
    } catch (error) {
      errors.push(fileError(yamlPath, error.message));
      continue;
    }

    const contentProblems = await validateEvalContent({
      evalDir,
      slug: dirName,
      parsedEval,
    });
    errors.push(
      ...contentProblems.map(({ filePath, message }) =>
        fileError(filePath, message),
      ),
    );

    if (parsedEval.id !== dirName) {
      errors.push(
        fileError(yamlPath, `id: must equal directory name "${dirName}"`),
      );
    }
    if (seenIds.has(parsedEval.id)) {
      errors.push(
        fileError(yamlPath, `id: duplicate eval id "${parsedEval.id}"`),
      );
    } else {
      seenIds.add(parsedEval.id);
      evalIds.push(parsedEval.id);
    }

    // 只校验 published-results 的模型身份：sample-result.json 用的是刻意造的
    // example/synthetic-* 参赛者，本来就不该出现在平台注册表里。
    await validatePublishedResults(evalDir, parsedEval, errors, modelIndex);

    if (!requiredStatus.get("sample-result.json")) {
      continue;
    }

    const resultPath = path.join(evalDir, "sample-result.json");
    try {
      const resultDocument = JSON.parse(await readFile(resultPath, "utf8"));
      const genericValidation = ResultFileSchema.safeParse(resultDocument);
      if (!genericValidation.success) {
        errors.push(fileError(resultPath, formatIssues(genericValidation.error)));
        continue;
      }

      const contextualValidation = validateResultForEval(
        parsedEval,
        genericValidation.data,
      );
      if (!contextualValidation.success) {
        errors.push(
          fileError(resultPath, formatIssues(contextualValidation.error)),
        );
      }
    } catch (error) {
      errors.push(fileError(resultPath, error.message));
    }
  }

  if (errors.length > 0) {
    throw new RepositoryValidationError(errors);
  }

  return { evalCount: evalIds.length, evalIds };
}

async function main() {
  const root = path.resolve(process.argv[2] ?? defaultRoot);
  const result = await validateRepository(root);
  console.log(
    `Validated ${result.evalCount} eval(s) in ${path.relative(process.cwd(), root) || "."}`,
  );
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
