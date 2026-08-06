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
      "evals/sample-eval/eval.yaml": "id: sample-eval\nrunner: builtin\n",
    },
  });
  assert.equal(result.mode, "community-eval-create");
  assert.equal(result.slug, "sample-eval");
  assert.equal(result.owner, "sample-author");
});

test("allows a new custom eval with an explicit mode and participant input", async () => {
  const result = await evaluate({
    changedFiles: [
      file("evals/sample-eval/AUTHORS", "added"),
      file("evals/sample-eval/eval.yaml", "added"),
    ],
    head: {
      "evals/sample-eval/AUTHORS": "@sample-author\n",
      "evals/sample-eval/eval.yaml": `id: sample-eval
runner: "custom" # quoted scalar with a trailing comment
custom_mode: 'external_workflow' # explicit for every new custom eval
command_template:
  # tasks/example-submission.json is injected only by the sandbox
  argv:
    - node
    - evals/sample-eval/pack.mjs
    - "{input}"
    - --out
    - "{output}"
`,
    },
  });
  assert.equal(result.mode, "community-eval-create");
});

test("requires new custom evals to declare custom_mode explicitly", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
      head: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": `id: sample-eval
runner: custom
command_template:
  argv: [node, evals/sample-eval/pack.mjs, "{input}", --out, "{output}"]
`,
      },
    },
    "custom_mode_required",
  );
});

test("rejects new custom eval commands that hard-code example fixtures", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
      head: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": `id: sample-eval
runner: custom
custom_mode: executable
command_template:
  argv:
    - node
    - evals/sample-eval/pack.mjs
    - "evals/sample-eval/tasks/example-evidence/submission.json"
    - --out
    - "{output}"
`,
      },
    },
    "example_input_hardcoded",
  );
});

for (const [label, fixturePath] of [
  ["an empty path segment", "evals/sample-eval/tasks//example-submission.json"],
  [
    "a current-directory segment",
    "evals/sample-eval/tasks/./example-submission.json",
  ],
]) {
  test(`rejects example fixtures hidden by ${label}`, async () => {
    await expectPolicyError(
      {
        changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
        head: {
          "evals/sample-eval/AUTHORS": "@sample-author\n",
          "evals/sample-eval/eval.yaml": `id: sample-eval
runner: custom
custom_mode: external_workflow
command_template:
  argv: [node, evals/sample-eval/pack.mjs, "${fixturePath}", --out, "{output}"]
`,
        },
      },
      "example_input_hardcoded",
    );
  });
}

for (const fixturePath of [
  "../tasks/example-submission.json",
  "evals/sample-eval/tasks/placeholder/../example-submission.json",
]) {
  test(`rejects parent-directory path segment in ${fixturePath}`, async () => {
    await expectPolicyError(
      {
        changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
        head: {
          "evals/sample-eval/AUTHORS": "@sample-author\n",
          "evals/sample-eval/eval.yaml": `id: sample-eval
runner: custom
custom_mode: external_workflow
command_template:
  argv: [node, evals/sample-eval/pack.mjs, "${fixturePath}", --out, "{output}"]
`,
        },
      },
      "ambiguous_custom_command",
    );
  });
}

test("rejects ambiguous multiline runner scalars for new evals", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
      head: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": `id: sample-eval
runner: >-
  custom
custom_mode: external_workflow
`,
      },
    },
    "ambiguous_new_eval_yaml",
  );
});

test("rejects YAML aliases in a new custom command", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
      head: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": `id: sample-eval
runner: custom
custom_mode: external_workflow
command_template: *shared-command
`,
      },
    },
    "ambiguous_custom_command",
  );
});

for (const indicator of ["|2-", ">2+"]) {
  test(`rejects command block scalar indicator ${indicator}`, async () => {
    await expectPolicyError(
      {
        changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
        head: {
          "evals/sample-eval/AUTHORS": "@sample-author\n",
          "evals/sample-eval/eval.yaml": `id: sample-eval
runner: custom
custom_mode: external_workflow
command_template:
  argv: ${indicator}
    node evals/sample-eval/pack.mjs {input} --out {output}
`,
        },
      },
      "ambiguous_custom_command",
    );
  });
}

test("rejects escaped command paths that could hide an example fixture", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
      head: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": `id: sample-eval
runner: custom
custom_mode: external_workflow
command_template:
  argv: [node, evals/sample-eval/pack.mjs, "evals/sample-eval/tasks\\u002fexample-submission.json", --out, "{output}"]
`,
      },
    },
    "ambiguous_custom_command",
  );
});

test("keeps legacy custom eval updates backward-compatible", async () => {
  const legacyDefinition = `id: sample-eval
runner: custom
command_template:
  argv: [node, evals/sample-eval/pack.mjs, evals/sample-eval/tasks/example-submission.json, --out, "{output}"]
`;
  const result = await evaluate({
    changedFiles: [file("evals/sample-eval/README.md")],
    base: {
      "evals/sample-eval/AUTHORS": "@sample-author\n",
      "evals/sample-eval/eval.yaml": legacyDefinition,
    },
    head: { "evals/sample-eval/eval.yaml": legacyDefinition },
  });
  assert.equal(result.mode, "community-eval-update");
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
        "evals/sample-eval/eval.yaml": "id: sample-eval\nrunner: builtin\n",
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
