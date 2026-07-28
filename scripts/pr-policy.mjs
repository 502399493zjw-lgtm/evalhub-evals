#!/usr/bin/env node

import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

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
    return { ...audit, mode: "maintenance", owner: MAINTAINER_LOGIN };
  }

  const slug = changed.slug;
  validateSlug(slug);
  const evalYamlPath = `evals/${slug}/eval.yaml`;
  const authorsPath = `evals/${slug}/AUTHORS`;
  const [baseEvalYaml, headEvalYaml] = await Promise.all([
    readText(baseRepository, baseSha, evalYamlPath),
    readText(headRepository, headSha, evalYamlPath),
  ]);

  if (baseEvalYaml !== null && headEvalYaml === null) {
    reject("eval_delete_forbidden", `deleting eval ${slug} is forbidden`);
  }
  if (headEvalYaml === null) {
    reject("required_file_missing", `${evalYamlPath} is missing from the PR head`);
  }

  const headId = parseEvalId(headEvalYaml, `head:${evalYamlPath}`);
  if (headId !== slug) {
    reject(
      "eval_id_mismatch",
      `head eval id ${JSON.stringify(headId)} must equal directory slug ${JSON.stringify(slug)}`,
    );
  }

  if (baseEvalYaml === null) {
    const headAuthors = await requiredText(
      readText,
      headRepository,
      headSha,
      authorsPath,
      `head:${authorsPath}`,
    );
    const owner = parseAuthors(headAuthors, `head:${authorsPath}`);
    if (!sameLogin(actor, owner)) {
      reject(
        "author_mismatch",
        `new eval owner @${owner} must match PR creator @${actor}`,
      );
    }
    return {
      ...audit,
      mode: sameLogin(owner, MAINTAINER_LOGIN)
        ? "official-eval-create"
        : "community-eval-create",
      owner,
      slug,
    };
  }

  if (changed.authorsChanged) {
    reject(
      "author_change_forbidden",
      `AUTHORS is immutable for existing eval ${slug}`,
    );
  }
  const baseId = parseEvalId(baseEvalYaml, `base:${evalYamlPath}`);
  if (baseId !== slug) {
    reject(
      "base_eval_id_mismatch",
      `base eval id ${JSON.stringify(baseId)} does not equal slug ${JSON.stringify(slug)}`,
    );
  }
  const baseAuthors = await requiredText(
    readText,
    baseRepository,
    baseSha,
    authorsPath,
    `base:${authorsPath}`,
  );
  const owner = parseAuthors(baseAuthors, `base:${authorsPath}`);
  if (!sameLogin(actor, owner)) {
    reject(
      "third_party_update_forbidden",
      `@${actor} cannot update eval ${slug}, which belongs to @${owner}`,
    );
  }
  return {
    ...audit,
    mode: sameLogin(owner, MAINTAINER_LOGIN)
      ? "official-eval-update"
      : "community-eval-update",
    owner,
    slug,
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
