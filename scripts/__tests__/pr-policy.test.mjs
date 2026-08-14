import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluatePullRequestPolicy,
  PullRequestPolicyError,
  resolveEvalSourceOwnerHandle,
} from "../pr-policy.mjs";

const baseRepository = "502399493zjw-lgtm/evalhub-evals";
const headRepository = "contributor/evalhub-evals";
const baseSha = "base-sha";
const headSha = "head-sha";
const taskId = "evaltask_243e0b48-c968-4968-80ee-29221bde6cff";

function marker(kind, slug, task = taskId) {
  return `<!-- evalhub-submission task=${task} kind=${kind} slug=${slug} -->`;
}

function file(filename, status = "modified", previous_filename) {
  return { filename, status, ...(previous_filename ? { previous_filename } : {}) };
}

function makeEvent(actor = "sample-author", body = "") {
  return {
    pull_request: {
      number: 42,
      body,
      user: { login: actor, id: 200 },
      base: { ref: "main", sha: baseSha, repo: { full_name: baseRepository } },
      head: { ref: "submission", sha: headSha, repo: { full_name: headRepository } },
    },
  };
}

function evalYaml({ id = "sample-eval", upstream, repository, runner = "builtin" } = {}) {
  return [
    `id: ${id}`,
    `runner: ${runner}`,
    upstream ? `upstream:\n  repo: ${upstream}` : "",
    repository ? `references:\n  repository: ${repository}` : "",
    "",
  ].filter(Boolean).join("\n");
}

function authors(handle) {
  return `@${handle}\n`;
}

async function evaluate({
  actor = "sample-author",
  body = "",
  changedFiles,
  base = {},
  head = {},
}) {
  const snapshots = new Map();
  for (const [pathname, contents] of Object.entries(base)) {
    snapshots.set(`${baseRepository}@${baseSha}:${pathname}`, contents);
  }
  for (const [pathname, contents] of Object.entries(head)) {
    snapshots.set(`${headRepository}@${headSha}:${pathname}`, contents);
  }
  return evaluatePullRequestPolicy({
    event: makeEvent(actor, body),
    listChangedFiles: async () => changedFiles,
    readText: async (repository, sha, pathname) =>
      snapshots.get(`${repository}@${sha}:${pathname}`) ?? null,
  });
}

async function expectPolicyError(options, expectedCode) {
  await assert.rejects(
    evaluate(options),
    (error) =>
      error instanceof PullRequestPolicyError && error.code === expectedCode,
  );
}

function createOptions({
  actor = "sample-author",
  body = marker("new", "sample-eval"),
  yaml = evalYaml({ upstream: "sample-author/source" }),
  author = actor,
  changedFiles = [
    file("evals/sample-eval/AUTHORS", "added"),
    file("evals/sample-eval/eval.yaml", "added"),
  ],
} = {}) {
  return {
    actor,
    body,
    changedFiles,
    head: {
      "evals/sample-eval/AUTHORS": authors(author),
      "evals/sample-eval/eval.yaml": yaml,
    },
  };
}

function updateOptions({
  actor = "source-owner",
  body = marker("update", "sample-eval"),
  baseYaml = evalYaml({ upstream: "source-owner/source" }),
  headYaml = baseYaml,
  baseAuthor = "maintainer",
  headAuthor = baseAuthor,
  changedFiles = [file("evals/sample-eval/README.md")],
} = {}) {
  return {
    actor,
    body,
    changedFiles,
    base: {
      "evals/sample-eval/AUTHORS": authors(baseAuthor),
      "evals/sample-eval/eval.yaml": baseYaml,
    },
    head: {
      "evals/sample-eval/AUTHORS": authors(headAuthor),
      "evals/sample-eval/eval.yaml": headYaml,
    },
  };
}

test("PR policy reruns when the editable submission marker changes", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/pr-policy.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /pull_request_target:[\s\S]*types:\s*\[[^\]]*\bedited\b[^\]]*\]/u);
});

test("creates a new eval when AUTHORS matches the PR actor", async () => {
  const result = await evaluate(createOptions());
  assert.equal(result.mode, "community-eval-create");
  assert.equal(result.owner, "sample-author");
  assert.equal(result.maintainer, "sample-author");
  assert.equal(result.submissionTask, taskId);
});

test("new evals resolve public author from upstream.repo", async () => {
  const result = await evaluate(createOptions({
    yaml: evalYaml({ upstream: "source-org/source-project" }),
  }));
  assert.equal(result.owner, "source-org");
});

test("new evals fall back to an exact references.repository homepage", async () => {
  const result = await evaluate(createOptions({
    yaml: evalYaml({ repository: "https://github.com/reference-org/source-project" }),
  }));
  assert.equal(result.owner, "reference-org");
});

test("new native evals fall back to the base eval repository owner", async () => {
  const result = await evaluate(createOptions({ yaml: evalYaml() }));
  assert.equal(result.owner, "502399493zjw-lgtm");
});

test("rejects a new eval whose AUTHORS does not match the PR actor", async () => {
  await expectPolicyError(createOptions({ author: "different-author" }), "author_mismatch");
});

test("allows the base public author to update an existing eval", async () => {
  const result = await evaluate(updateOptions({ actor: "source-owner" }));
  assert.equal(result.mode, "community-eval-update");
  assert.equal(result.owner, "source-owner");
  assert.equal(result.baseOwner, "source-owner");
  assert.equal(result.maintainer, "maintainer");
});

test("allows the AUTHORS maintainer to update an existing eval", async () => {
  const result = await evaluate(updateOptions({ actor: "maintainer" }));
  assert.equal(result.mode, "community-eval-update");
});

test("keeps the public author based on head source metadata after an authorized update", async () => {
  const result = await evaluate(updateOptions({
    actor: "source-owner",
    headYaml: evalYaml({ upstream: "new-public-author/source" }),
  }));
  assert.equal(result.baseOwner, "source-owner");
  assert.equal(result.owner, "new-public-author");
});

test("does not let a head source change self-authorize a third party", async () => {
  await expectPolicyError(updateOptions({
    actor: "attacker",
    headYaml: evalYaml({ upstream: "attacker/source" }),
  }), "third_party_update_forbidden");
});

test("requires AUTHORS to remain byte-for-byte identical on update", async () => {
  await expectPolicyError(updateOptions({
    actor: "source-owner",
    headAuthor: "maintainer",
    baseAuthor: "base-maintainer",
  }), "author_change_forbidden");
});

test("organization members are not automatically public-authorized", async () => {
  await expectPolicyError(updateOptions({
    actor: "org-member",
    baseYaml: evalYaml({ upstream: "source-org/source" }),
  }), "third_party_update_forbidden");
});

test("rejects deletion because this gate only supports create and update", async () => {
  await expectPolicyError({
    actor: "source-owner",
    body: "",
    changedFiles: [file("evals/sample-eval/eval.yaml", "removed")],
    base: {
      "evals/sample-eval/AUTHORS": authors("maintainer"),
      "evals/sample-eval/eval.yaml": evalYaml({ upstream: "source-owner/source" }),
    },
    head: {},
  }, "eval_delete_forbidden");
});

test("validates marker kind and slug", async () => {
  await expectPolicyError(createOptions({ body: marker("update", "sample-eval") }), "submission_marker_kind_mismatch");
  await expectPolicyError(createOptions({ body: marker("new", "other-eval") }), "submission_marker_slug_mismatch");
});

test("requires a marker for non-maintainer submission PRs", async () => {
  await expectPolicyError(createOptions({ body: "" }), "submission_marker_required");
  await expectPolicyError(updateOptions({ body: "" }), "submission_marker_required");
});

test("rejects malformed source repository metadata", async () => {
  assert.throws(
    () => resolveEvalSourceOwnerHandle({
      evalYaml: evalYaml({ repository: "https://github.com/source-org/source-project/tree/main" }),
      nativeRepository: baseRepository,
    }),
    (error) => error instanceof PullRequestPolicyError && error.code === "source_owner_unavailable",
  );
  assert.throws(
    () => resolveEvalSourceOwnerHandle({
      evalYaml: evalYaml({ upstream: "source-org/source-project?query=1" }),
      nativeRepository: baseRepository,
    }),
    (error) => error instanceof PullRequestPolicyError && error.code === "source_owner_unavailable",
  );
});

test("rejects invalid slug and mixed repository changes", async () => {
  await expectPolicyError({
    ...createOptions(),
    changedFiles: [file("evals/bad--slug/eval.yaml", "added")],
    head: {
      "evals/bad--slug/eval.yaml": evalYaml({ id: "bad--slug", upstream: "sample-author/source" }),
      "evals/bad--slug/AUTHORS": authors("sample-author"),
    },
  }, "invalid_slug");
  await expectPolicyError({
    ...createOptions(),
    changedFiles: [
      file("evals/sample-eval/eval.yaml", "added"),
      file("README.md", "modified"),
    ],
  }, "maintenance_mixed_with_eval");
});

test("preserves strict new custom-runner validation", async () => {
  await expectPolicyError(createOptions({
    yaml: evalYaml({ upstream: "sample-author/source", runner: "custom" }),
  }), "custom_mode_required");
  await expectPolicyError(createOptions({
    yaml: `${evalYaml({ upstream: "sample-author/source", runner: "custom" })}\ncustom_mode: executable\ncommand_template:\n  argv:\n    - node\n    - tasks/example-submission.json\n    - "{output}"\n`,
    changedFiles: [
      file("evals/sample-eval/AUTHORS", "added"),
      file("evals/sample-eval/eval.yaml", "added"),
    ],
  }), "example_input_hardcoded");
});
