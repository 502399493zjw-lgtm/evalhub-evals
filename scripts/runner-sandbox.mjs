#!/usr/bin/env node

import { ResultFileSchema, validateResultForEval } from "@evalhub/schemas";
import { chmod, lstat, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseDocument } from "yaml";

export const RUNNER_IMAGE =
  "node:26-bookworm-slim@sha256:2d49d876e96237d76de412761cf05dbfe5aee325cc4406a4d41d5824c5bb8beb";
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDir, "..");

function hostSandboxUser() {
  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  const gid = typeof process.getgid === "function" ? process.getgid() : 1000;
  return `${uid > 0 ? uid : 1000}:${gid > 0 ? gid : 1000}`;
}

function parseYaml(source, filePath) {
  const document = parseDocument(source, {
    maxAliasCount: 20,
    prettyErrors: false,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new Error(`${filePath}: ${document.errors.map((error) => error.message).join("; ")}`);
  }
  return document.toJS({ maxAliasCount: 20 });
}

function parseArgs(argv) {
  let repositoryRoot = defaultRoot;
  let dependencyRoot;
  let staticOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--static-only") {
      staticOnly = true;
    } else if (token === "--dependency-root") {
      dependencyRoot = argv[index + 1];
      if (!dependencyRoot) throw new Error("--dependency-root requires a path");
      index += 1;
    } else if (!token.startsWith("-") && repositoryRoot === defaultRoot) {
      repositoryRoot = token;
    } else {
      throw new Error(`unknown argument: ${token}`);
    }
  }
  return {
    repositoryRoot: path.resolve(repositoryRoot),
    dependencyRoot: path.resolve(dependencyRoot ?? repositoryRoot),
    staticOnly,
  };
}

async function loadCustomEvals(repositoryRoot) {
  const evalsRoot = path.join(repositoryRoot, "evals");
  const entries = await readdir(evalsRoot, { withFileTypes: true });
  const custom = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if (!entry.isDirectory()) continue;
    const filePath = path.join(evalsRoot, entry.name, "eval.yaml");
    const definition = parseYaml(await readFile(filePath, "utf8"), filePath);
    if (definition?.runner === "custom") {
      custom.push({ slug: entry.name, definition });
    }
  }
  return custom;
}

export function buildDockerArgs({
  evalDir,
  dependencyRoot,
  slug,
  argv,
  outputDir,
  containerName = `evalhub-${slug}-test`,
  containerUser = hostSandboxUser(),
}) {
  const containerInput = `/workspace/evals/${slug}/tasks/example-submission.json`;
  const containerArgv = argv.map((token) =>
    token === "{output}"
      ? "/output/result.json"
      : token === "{input}"
        ? containerInput
        : token,
  );
  return [
    "run",
    "--rm",
    "--name",
    containerName,
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--pids-limit",
    "64",
    "--memory",
    "512m",
    "--memory-swap",
    "512m",
    "--cpus",
    "1",
    "--ulimit",
    "nofile=64:64",
    "--ulimit",
    `fsize=${MAX_OUTPUT_BYTES}:${MAX_OUTPUT_BYTES}`,
    "--stop-timeout",
    "1",
    "--user",
    containerUser,
    "--env",
    "HOME=/nonexistent",
    "--env",
    "NODE_ENV=production",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=64m",
    "--mount",
    `type=bind,src=${evalDir},dst=/workspace/evals/${slug},readonly`,
    "--mount",
    `type=bind,src=${path.join(dependencyRoot, "node_modules")},dst=/workspace/node_modules,readonly`,
    "--mount",
    `type=bind,src=${path.join(dependencyRoot, "vendor")},dst=/workspace/vendor,readonly`,
    "--mount",
    `type=bind,src=${outputDir},dst=/output`,
    "--workdir",
    "/workspace",
    RUNNER_IMAGE,
    ...containerArgv,
  ];
}

async function validateOutput(outputPath, definition, slug) {
  const outputEntries = await readdir(path.dirname(outputPath), {
    withFileTypes: true,
  });
  if (
    outputEntries.length !== 1 ||
    outputEntries[0].name !== path.basename(outputPath) ||
    !outputEntries[0].isFile()
  ) {
    throw new Error(`${slug}: runner may write only the declared result file`);
  }
  const metadata = await lstat(outputPath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${slug}: runner output must be a regular file`);
  }
  if (metadata.size > MAX_OUTPUT_BYTES) {
    throw new Error(`${slug}: runner output exceeds ${MAX_OUTPUT_BYTES} bytes`);
  }
  const parsed = JSON.parse(await readFile(outputPath, "utf8"));
  const generic = ResultFileSchema.safeParse(parsed);
  if (!generic.success) {
    throw new Error(`${slug}: runner output does not match ResultFileSchema: ${generic.error.message}`);
  }
  const contextual = validateResultForEval(definition, generic.data);
  if (!contextual.success) {
    throw new Error(`${slug}: runner output is invalid for its eval: ${contextual.error.message}`);
  }
}

export async function runSandboxChecks({
  repositoryRoot = defaultRoot,
  dependencyRoot = repositoryRoot,
  staticOnly = false,
  spawn = spawnSync,
} = {}) {
  const root = path.resolve(repositoryRoot);
  const dependencies = path.resolve(dependencyRoot);
  const custom = await loadCustomEvals(root);
  if (staticOnly) return { checked: custom.map(({ slug }) => slug), executed: 0 };

  const dependencyMetadata = await lstat(path.join(dependencies, "node_modules"));
  if (!dependencyMetadata.isDirectory()) {
    throw new Error("node_modules is required under dependency root");
  }

  for (const { slug, definition } of custom) {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), `evalhub-runner-${slug}-`));
    await chmod(outputDir, 0o777);
    try {
      const containerName = `evalhub-${slug}-${randomUUID()}`;
      const dockerArgs = buildDockerArgs({
        evalDir: path.join(root, "evals", slug),
        dependencyRoot: dependencies,
        slug,
        argv: definition.command_template.argv,
        outputDir,
        containerName,
      });
      const result = spawn("docker", dockerArgs, {
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        timeout: 60_000,
      });
      if (result.error) {
        spawn("docker", ["rm", "--force", containerName], {
          encoding: "utf8",
          timeout: 10_000,
        });
        throw result.error;
      }
      if (result.status !== 0) {
        const diagnostic = String(result.stderr || result.stdout || "runner failed")
          .trim()
          .slice(0, 4000);
        throw new Error(`${slug}: sandboxed runner failed: ${diagnostic}`);
      }
      await validateOutput(path.join(outputDir, "result.json"), definition, slug);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  }
  return { checked: custom.map(({ slug }) => slug), executed: custom.length };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runSandboxChecks(options);
  console.log(
    result.executed === 0
      ? `Validated ${result.checked.length} custom runner definition(s) without execution`
      : `Executed ${result.executed} custom runner(s) in the locked Docker sandbox`,
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
