import { lstat, readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { parseDocument } from "yaml";

export const CONTENT_LIMITS = Object.freeze({
  maxFiles: 150,
  maxTotalBytes: 25 * 1024 * 1024,
  maxTextBytes: 2 * 1024 * 1024,
  maxImageBytes: 8 * 1024 * 1024,
  maxPathBytes: 240,
  maxDepth: 8,
});

const ALLOWED_EXTENSIONS = new Set([
  ".cjs",
  ".json",
  ".jsonl",
  ".js",
  ".md",
  ".mjs",
  ".py",
  ".sh",
  ".svg",
  ".txt",
  ".ts",
  ".yaml",
]);
const IMAGE_EXTENSIONS = new Set([".svg"]);
const BIDI_OR_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u;
const LFS_POINTER = /^version https:\/\/git-lfs\.github\.com\/spec\/v1\s*$/mu;
const SECRET_PATTERNS = [
  { label: "private key", pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/u },
  { label: "GitHub token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/u },
  { label: "AWS access key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u },
  { label: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/u },
];

function problem(filePath, message) {
  return { filePath, message };
}

function hasExecutableOrArchiveMagic(bytes) {
  const hex = bytes.subarray(0, 8).toString("hex");
  return (
    hex.startsWith("7f454c46") || // ELF
    hex.startsWith("4d5a") || // PE/Windows executable
    ["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe"].some((magic) =>
      hex.startsWith(magic),
    ) ||
    hex.startsWith("0061736d") || // WebAssembly
    hex.startsWith("504b0304") || // zip-compatible archive
    hex.startsWith("1f8b") || // gzip
    hex.startsWith("425a68") || // bzip2
    hex.startsWith("fd377a585a00") || // xz
    hex.startsWith("377abcaf271c") // 7z
  );
}

function decodeUtf8(bytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function validateStructuredText(filePath, extension, source, errors) {
  try {
    if (extension === ".json") {
      JSON.parse(source);
    } else if (extension === ".jsonl") {
      for (const [index, line] of source.split(/\r?\n/u).entries()) {
        if (line.trim().length > 0) JSON.parse(line);
      }
    } else if (extension === ".yaml") {
      const document = parseDocument(source, {
        maxAliasCount: 20,
        prettyErrors: false,
        uniqueKeys: true,
      });
      if (document.errors.length > 0) {
        throw new Error(document.errors.map((error) => error.message).join("; "));
      }
      document.toJS({ maxAliasCount: 20 });
    }
  } catch (error) {
    errors.push(problem(filePath, `invalid ${extension.slice(1).toUpperCase()}: ${error.message}`));
  }
}

function validateSvg(filePath, source, errors) {
  const activePatterns = [
    /<\s*script\b/iu,
    /<\s*foreignObject\b/iu,
    /\son[a-z]+\s*=/iu,
    /\b(?:href|src)\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)/iu,
    /@import\b/iu,
    /url\s*\(\s*["']?\s*(?:https?:|data:|javascript:|\/\/)/iu,
  ];
  if (activePatterns.some((pattern) => pattern.test(source))) {
    errors.push(problem(filePath, "SVG must not contain scripts, event handlers, foreignObject, or external/data resources"));
  }
}

async function validateCommandTemplate(evalDir, slug, parsedEval, errors) {
  if (parsedEval?.runner !== "custom") return;
  const yamlPath = path.join(evalDir, "eval.yaml");
  const argv = parsedEval.command_template?.argv;
  if (!Array.isArray(argv)) {
    errors.push(problem(yamlPath, "custom runner requires command_template.argv"));
    return;
  }
  const expectedPrefix = `evals/${slug}/`;
  if (argv.filter((token) => token === "{output}").length !== 1) {
    errors.push(problem(yamlPath, "custom runner command must contain {output} exactly once"));
  }
  for (const token of argv) {
    if (typeof token !== "string") continue;

    // Repository references may be written as an option value
    // (`--config=evals/<slug>/...`) or with one or more leading `./` segments.
    // URLs are runtime inputs, not checked-in repository paths.
    let reference = token;
    const assignment = /^(?:-{1,2}[^=]+|[A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(reference);
    if (assignment !== null) reference = assignment[1];
    if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//u.test(reference)) continue;

    const pathSegments = reference.split(/[\\/]/u);
    if (pathSegments.includes("..")) {
      errors.push(problem(yamlPath, `custom runner repository path references cannot traverse a parent directory: ${token}`));
      continue;
    }
    const normalizedReference = reference.replace(/^(?:\.\/)+/u, "");
    if (!normalizedReference.startsWith("evals/")) continue;
    if (!normalizedReference.startsWith(expectedPrefix)) {
      errors.push(problem(yamlPath, `custom runner repository paths must stay inside ${expectedPrefix}`));
      continue;
    }

    const relativeReference = normalizedReference.slice(expectedPrefix.length);
    const segments = relativeReference.split("/");
    if (
      relativeReference.length === 0 ||
      segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
    ) {
      errors.push(problem(yamlPath, `custom runner has an invalid repository path reference: ${token}`));
      continue;
    }

    const referencedPath = path.resolve(evalDir, ...segments);
    const evalRoot = `${path.resolve(evalDir)}${path.sep}`;
    if (!referencedPath.startsWith(evalRoot)) {
      errors.push(problem(yamlPath, `custom runner repository paths must stay inside ${expectedPrefix}`));
      continue;
    }
    try {
      const metadata = await lstat(referencedPath);
      if (!metadata.isFile() && !metadata.isDirectory()) {
        errors.push(problem(yamlPath, `custom runner reference must resolve to a regular file or directory: ${token}`));
      }
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        errors.push(problem(yamlPath, `custom runner references a missing repository path: ${token}`));
      } else {
        errors.push(problem(yamlPath, `unable to inspect custom runner reference ${token}: ${error.message}`));
      }
    }
  }
  const output = parsedEval.command_template?.output;
  if (
    typeof output !== "string" ||
    output.length === 0 ||
    output !== path.basename(output) ||
    path.extname(output).toLowerCase() !== ".json"
  ) {
    errors.push(problem(yamlPath, "custom runner output must be a JSON basename"));
  }
}

export async function validateEvalContent({ evalDir, slug, parsedEval = null }) {
  const errors = [];
  const files = [];
  const foldedPaths = new Map();
  let totalBytes = 0;

  async function visit(directory, segments) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const relativeSegments = [...segments, entry.name];
      const relativePath = relativeSegments.join("/");
      const filePath = path.join(evalDir, ...relativeSegments);
      let metadata;
      try {
        metadata = await lstat(filePath);
      } catch (error) {
        errors.push(problem(filePath, `unable to inspect path: ${error.message}`));
        continue;
      }
      if (entry.name.startsWith(".")) {
        errors.push(problem(filePath, "hidden files and directories are not allowed"));
      }
      if (Buffer.byteLength(relativePath, "utf8") > CONTENT_LIMITS.maxPathBytes) {
        errors.push(problem(filePath, `path exceeds ${CONTENT_LIMITS.maxPathBytes} UTF-8 bytes`));
      }
      if (relativeSegments.length > CONTENT_LIMITS.maxDepth) {
        errors.push(problem(filePath, `path depth exceeds ${CONTENT_LIMITS.maxDepth}`));
      }
      if (BIDI_OR_CONTROL.test(relativePath)) {
        errors.push(problem(filePath, "path contains control or bidirectional override characters"));
      }
      const folded = relativePath.normalize("NFC").toLocaleLowerCase("en-US");
      const collision = foldedPaths.get(folded);
      if (collision !== undefined && collision !== relativePath) {
        errors.push(problem(filePath, `case/Unicode-collides with ${collision}`));
      } else {
        foldedPaths.set(folded, relativePath);
      }

      if (metadata.isSymbolicLink()) {
        errors.push(problem(filePath, "symbolic links are not allowed"));
      } else if (metadata.isDirectory()) {
        await visit(filePath, relativeSegments);
      } else if (!metadata.isFile()) {
        errors.push(problem(filePath, "only regular files and directories are allowed"));
      } else {
        files.push({ filePath, relativePath, metadata });
      }
    }
  }

  try {
    await visit(evalDir, []);
  } catch (error) {
    errors.push(problem(evalDir, `unable to enumerate eval content: ${error.message}`));
    return errors;
  }

  if (files.length > CONTENT_LIMITS.maxFiles) {
    errors.push(problem(evalDir, `contains ${files.length} files; limit is ${CONTENT_LIMITS.maxFiles}`));
  }

  for (const { filePath, relativePath, metadata } of files) {
    totalBytes += metadata.size;
    const extension = path.extname(relativePath).toLowerCase();
    if (relativePath !== "AUTHORS" && !ALLOWED_EXTENSIONS.has(extension)) {
      errors.push(problem(filePath, `file type ${extension || "<none>"} is not allowed`));
      continue;
    }
    const perFileLimit = IMAGE_EXTENSIONS.has(extension)
      ? CONTENT_LIMITS.maxImageBytes
      : CONTENT_LIMITS.maxTextBytes;
    if (metadata.size > perFileLimit) {
      errors.push(problem(filePath, `file exceeds ${perFileLimit} bytes`));
      continue;
    }

    let bytes;
    try {
      bytes = await readFile(filePath);
    } catch (error) {
      errors.push(problem(filePath, `unable to read file: ${error.message}`));
      continue;
    }
    if (hasExecutableOrArchiveMagic(bytes)) {
      errors.push(problem(filePath, "executable, archive, or WebAssembly content is not allowed"));
      continue;
    }
    let source;
    try {
      source = decodeUtf8(bytes);
    } catch {
      errors.push(problem(filePath, "file must be valid UTF-8 text"));
      continue;
    }
    if (BIDI_OR_CONTROL.test(source)) {
      errors.push(problem(filePath, "content contains forbidden control or bidirectional override characters"));
    }
    if (LFS_POINTER.test(source)) {
      errors.push(problem(filePath, "Git LFS pointer files are not allowed"));
    }
    for (const { label, pattern } of SECRET_PATTERNS) {
      if (pattern.test(source)) errors.push(problem(filePath, `possible ${label} detected`));
    }
    validateStructuredText(filePath, extension, source, errors);
    if (extension === ".svg") validateSvg(filePath, source, errors);
  }

  if (totalBytes > CONTENT_LIMITS.maxTotalBytes) {
    errors.push(problem(evalDir, `total content is ${totalBytes} bytes; limit is ${CONTENT_LIMITS.maxTotalBytes}`));
  }
  await validateCommandTemplate(evalDir, slug, parsedEval, errors);
  return errors;
}

export async function validateNoGitlinks(repositoryRoot) {
  const gitMetadataPath = path.join(repositoryRoot, ".git");
  try {
    await lstat(gitMetadataPath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return [];
    return [problem(gitMetadataPath, `unable to inspect Git metadata: ${error.message}`)];
  }
  const result = spawnSync(
    "git",
    ["-C", repositoryRoot, "ls-files", "--stage", "--", "evals"],
    { encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 10_000 },
  );
  if (result.error || result.status !== 0) {
    return [
      problem(
        gitMetadataPath,
        `unable to inspect Git file modes: ${result.error?.message ?? String(result.stderr).trim()}`,
      ),
    ];
  }
  const problems = [];
  for (const line of result.stdout.split(/\r?\n/u)) {
    const match = /^160000 [0-9a-f]+ \d+\t(.+)$/u.exec(line);
    if (match) {
      problems.push(problem(path.join(repositoryRoot, match[1]), "Git submodules are not allowed inside evals"));
    }
  }
  return problems;
}
