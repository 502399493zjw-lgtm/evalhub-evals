import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluatePullRequestPolicy,
  MAINTAINER_LOGIN,
  PullRequestPolicyError,
} from "../pr-policy.mjs";

const baseRepository = "502399493zjw-lgtm/evalhub-evals";
const headRepository = "contributor/evalhub-evals";
const baseSha = "base-sha";
const headSha = "head-sha";

function makeEvent(actor = "sample-author") {
  return {
    pull_request: {
      number: 42,
      body: "AUTHORS: @spoofed-author",
      user: { login: actor, id: actor === MAINTAINER_LOGIN ? 1 : 200 },
      base: { ref: "main", sha: baseSha, repo: { full_name: baseRepository } },
      head: { ref: "submission", sha: headSha, repo: { full_name: headRepository } },
    },
  };
}

function file(filename, status = "modified", previous_filename) {
  return { filename, status, ...(previous_filename ? { previous_filename } : {}) };
}

function snapshotKey(repository, sha, pathname) {
  return `${repository}@${sha}:${pathname}`;
}

async function evaluate({
  actor = "sample-author",
  changedFiles,
  base = {},
  head = {},
}) {
  const snapshots = new Map();
  for (const [pathname, contents] of Object.entries(base)) {
    snapshots.set(snapshotKey(baseRepository, baseSha, pathname), contents);
  }
  for (const [pathname, contents] of Object.entries(head)) {
    snapshots.set(snapshotKey(headRepository, headSha, pathname), contents);
  }
  return evaluatePullRequestPolicy({
    event: makeEvent(actor),
    listChangedFiles: async () => changedFiles,
    readText: async (repository, sha, pathname) =>
      snapshots.get(snapshotKey(repository, sha, pathname)) ?? null,
  });
}

async function expectPolicyError(options, expectedCode) {
  await assert.rejects(
    evaluate(options),
    (error) =>
      error instanceof PullRequestPolicyError && error.code === expectedCode,
  );
}

test("allows a user to create one eval owned by their GitHub identity", async () => {
  const result = await evaluate({
    changedFiles: [
      file("evals/sample-eval/AUTHORS", "added"),
      file("evals/sample-eval/eval.yaml", "added"),
      file("evals/sample-eval/README.md", "added"),
    ],
    head: {
      "evals/sample-eval/AUTHORS": "@sample-author\n",
      "evals/sample-eval/eval.yaml": "id: sample-eval\n",
    },
  });
  assert.equal(result.mode, "community-eval-create");
  assert.equal(result.slug, "sample-eval");
  assert.equal(result.owner, "sample-author");
});

test("allows an author to update their own eval", async () => {
  const result = await evaluate({
    changedFiles: [file("evals/sample-eval/README.md")],
    base: {
      "evals/sample-eval/AUTHORS": "@sample-author\n",
      "evals/sample-eval/eval.yaml": "id: sample-eval\n",
    },
    head: { "evals/sample-eval/eval.yaml": "id: sample-eval\n" },
  });
  assert.equal(result.mode, "community-eval-update");
});

test("rejects a third party even if the PR body claims author approval", async () => {
  await expectPolicyError(
    {
      actor: "third-party",
      changedFiles: [file("evals/sample-eval/README.md")],
      base: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": "id: sample-eval\n",
      },
      head: { "evals/sample-eval/eval.yaml": "id: sample-eval\n" },
    },
    "third_party_update_forbidden",
  );
});

test("rejects changing AUTHORS on an existing eval", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/AUTHORS")],
      base: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": "id: sample-eval\n",
      },
      head: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": "id: sample-eval\n",
      },
    },
    "author_change_forbidden",
  );
});

test("rejects a new eval whose owner differs from the PR creator", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
      head: {
        "evals/sample-eval/AUTHORS": "@different-owner\n",
        "evals/sample-eval/eval.yaml": "id: sample-eval\n",
      },
    },
    "author_mismatch",
  );
});

test("rejects changes to multiple eval slugs", async () => {
  await expectPolicyError(
    {
      changedFiles: [
        file("evals/sample-eval/README.md"),
        file("evals/other-eval/README.md"),
      ],
    },
    "multiple_slugs_changed",
  );
});

test("rejects an eval change mixed with repository maintenance", async () => {
  await expectPolicyError(
    {
      changedFiles: [
        file("evals/sample-eval/README.md"),
        file(".github/workflows/validate.yml"),
      ],
    },
    "maintenance_mixed_with_eval",
  );
});

test("allows only the maintainer to open a repository maintenance PR", async () => {
  const result = await evaluate({
    actor: MAINTAINER_LOGIN,
    changedFiles: [file("scripts/validate.mjs"), file("package.json")],
  });
  assert.equal(result.mode, "maintenance");

  await expectPolicyError(
    {
      actor: "sample-author",
      changedFiles: [file("scripts/validate.mjs")],
    },
    "maintenance_actor_required",
  );
});

test("rejects a contributor deleting an eval", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/eval.yaml", "removed")],
      base: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": "id: sample-eval\n",
      },
    },
    "eval_delete_forbidden",
  );
});

test("allows the maintainer to delete an eval", async () => {
  const result = await evaluate({
    actor: MAINTAINER_LOGIN,
    changedFiles: [file("evals/sample-eval/eval.yaml", "removed")],
    base: {
      "evals/sample-eval/AUTHORS": "@sample-author\n",
      "evals/sample-eval/eval.yaml": "id: sample-eval\n",
    },
  });
  assert.equal(result.mode, "maintainer-eval-delete");
  assert.equal(result.slug, "sample-eval");
  assert.equal(result.owner, "sample-author");
});

test("rejects renaming a slug", async () => {
  await expectPolicyError(
    {
      changedFiles: [
        file(
          "evals/new-slug/eval.yaml",
          "renamed",
          "evals/old-slug/eval.yaml",
        ),
      ],
    },
    "slug_rename_forbidden",
  );
});

test("rejects an eval id that differs from the directory slug", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
      head: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": "id: other-eval\n",
      },
    },
    "eval_id_mismatch",
  );
});

test("recognizes a maintainer-owned eval as official", async () => {
  const result = await evaluate({
    actor: MAINTAINER_LOGIN,
    changedFiles: [file("evals/official-eval/README.md")],
    base: {
      "evals/official-eval/AUTHORS": `@${MAINTAINER_LOGIN}\n`,
      "evals/official-eval/eval.yaml": "id: official-eval\n",
    },
    head: { "evals/official-eval/eval.yaml": "id: official-eval\n" },
  });
  assert.equal(result.mode, "official-eval-update");
});
