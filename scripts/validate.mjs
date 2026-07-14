#!/usr/bin/env node

import {
  EvalDefSchema,
  ResultFileSchema,
  validateResultForEval,
} from "@evalhub/schemas";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseDocument } from "yaml";

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
const EXACT_EVAL_CODEOWNERS_PATTERN = /^\/evals\/([^/]+)\/$/u;
const ROOT_EVAL_CODEOWNERS_PATTERN = /^\/?evals(?:\/|$|[?*\[])/u;
const CODEOWNERS_WILDCARD_PATTERN = /[?*\[\]]/u;

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

    const exactMatch =
      pattern === undefined || CODEOWNERS_WILDCARD_PATTERN.test(pattern)
        ? null
        : EXACT_EVAL_CODEOWNERS_PATTERN.exec(pattern);
    const targetsEvalTree =
      pattern !== undefined && ROOT_EVAL_CODEOWNERS_PATTERN.test(pattern);
    if (targetsEvalTree && exactMatch === null) {
      errors.push(
        fileError(
          filePath,
          `line ${lineNumber}: eval ownership pattern must be an exact /evals/<slug>/ path without wildcards`,
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
  authorHandle,
  evalFilePaths,
  errors,
) {
  if (!codeowners.available) {
    return;
  }

  const expectedPattern = `/evals/${dirName}/`;
  const matches = codeowners.entries.filter(
    (entry) => entry.pattern === expectedPattern,
  );
  if (matches.length === 0) {
    errors.push(
      fileError(
        codeowners.filePath,
        `${expectedPattern}: exact rule is missing`,
      ),
    );
    return;
  }
  if (matches.length > 1) {
    errors.push(
      fileError(
        codeowners.filePath,
        `${expectedPattern}: duplicate exact rules at lines ${matches
          .map((entry) => entry.lineNumber)
          .join(", ")}`,
      ),
    );
    return;
  }

  const [match] = matches;
  if (!match.tokenCountValid || authorHandle === null) {
    return;
  }
  if (match.owner !== authorHandle) {
    errors.push(
      fileError(
        codeowners.filePath,
        `${expectedPattern}: owner ${match.owner} does not match AUTHORS ${authorHandle}`,
      ),
    );
    return;
  }

  const effectiveMatch = effectiveCodeownerForEval(codeowners.entries, dirName);
  if (effectiveMatch !== null && effectiveMatch.owner !== authorHandle) {
    errors.push(
      fileError(
        codeowners.filePath,
        `${expectedPattern}: effective owner ${effectiveMatch.owner} from line ${effectiveMatch.lineNumber} does not match AUTHORS ${authorHandle}`,
      ),
    );
    return;
  }

  for (const repositoryPath of evalFilePaths) {
    const effectiveFileMatch = effectiveCodeownerForPath(
      codeowners.entries,
      repositoryPath,
    );
    if (
      effectiveFileMatch !== null &&
      effectiveFileMatch.owner !== authorHandle
    ) {
      errors.push(
        fileError(
          codeowners.filePath,
          `${repositoryPath.join("/")}: effective owner ${effectiveFileMatch.owner} from line ${effectiveFileMatch.lineNumber} does not match AUTHORS ${authorHandle}`,
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

export async function validateRepository(repositoryRoot = defaultRoot) {
  const root = path.resolve(repositoryRoot);
  const evalsDir = path.join(root, "evals");
  const errors = [];
  const evalIds = [];
  const seenIds = new Set();
  const evalDirectories = await listEvalDirectories(evalsDir);
  const codeowners = await loadCodeowners(root);
  errors.push(...codeowners.errors);

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

    const authorHandle = await readAuthorHandle(
      evalDir,
      requiredStatus.get("AUTHORS") === true,
      errors,
    );
    validateCodeownerForEval(
      codeowners,
      dirName,
      authorHandle,
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
