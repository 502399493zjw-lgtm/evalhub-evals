#!/usr/bin/env node

import {
  EvalDefSchema,
  ResultFileSchema,
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

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, "..");

const REQUIRED_FILES = [
  "eval.yaml",
  "README.md",
  "AUTHORS",
  "sample-result.json",
];
const REQUIRED_DIRECTORIES = ["tasks", "assets"];
const AUTHORS_PLACEHOLDER = "@TODO-github-handle";
const AUTHORS_HANDLE_PATTERN =
  /^@[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/u;
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

  const meaningfulLines = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (meaningfulLines.length !== 1) {
    errors.push(
      fileError(
        authorsPath,
        `AUTHORS: expected exactly one meaningful GitHub handle line; found ${meaningfulLines.length}`,
      ),
    );
    return null;
  }

  const handle = meaningfulLines[0];
  if (handle === AUTHORS_PLACEHOLDER) {
    errors.push(
      fileError(
        authorsPath,
        `AUTHORS: ${AUTHORS_PLACEHOLDER} is a scaffold placeholder`,
      ),
    );
    return null;
  }
  if (!AUTHORS_HANDLE_PATTERN.test(handle)) {
    errors.push(
      fileError(
        authorsPath,
        "AUTHORS: meaningful line must be one GitHub handle matching /^@[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/",
      ),
    );
    return null;
  }

  return handle;
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

async function validatePublishedResults(evalDir, parsedEval, errors) {
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
      const contextual = validateResultForEval(parsedEval, generic.data);
      if (!contextual.success) {
        errors.push(fileError(filePath, formatIssues(contextual.error)));
      }
    } catch (error) {
      errors.push(fileError(filePath, error.message));
    }
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

    await validatePublishedResults(evalDir, parsedEval, errors);

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
