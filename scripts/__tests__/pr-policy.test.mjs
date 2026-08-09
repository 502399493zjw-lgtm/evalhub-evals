import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  evaluatePullRequestPolicy,
  MAINTAINER_LOGIN,
  PullRequestPolicyError,
  readOwnershipHistoryFromGit,
  reduceOwnershipHistory,
} from "../pr-policy.mjs";

const baseRepository = "502399493zjw-lgtm/evalhub-evals";
const headRepository = "contributor/evalhub-evals";
const baseSha = "base-sha";
const headSha = "head-sha";

const taskId = "evaltask_243e0b48-c968-4968-80ee-29221bde6cff";
const otherTaskId = "evaltask_6cd42f94-1a05-4d7b-9f0e-2b8c1d4e5f60";

test("reruns the trusted PR policy when the mutable pull request body is edited", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/pr-policy.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /pull_request_target:[\s\S]*types:\s*\[[^\]]*\bedited\b[^\]]*\]/u);
});

function marker(kind, slug, task = taskId) {
  return `<!-- evalhub-submission task=${task} kind=${kind} slug=${slug} -->`;
}

function submissionBody(kind, slug, task = taskId) {
  return `AUTHORS: @spoofed-author\n\n${marker(kind, slug, task)}\n`;
}

function makeEvent(actor = "sample-author", body = "AUTHORS: @spoofed-author") {
  return {
    pull_request: {
      number: 42,
      body,
      user: { login: actor, id: actor === MAINTAINER_LOGIN ? 1 : 200 },
      base: { ref: "main", sha: baseSha, repo: { full_name: baseRepository } },
      head: { ref: "submission", sha: headSha, repo: { full_name: headRepository } },
    },
  };
}

function file(filename, status = "modified", previous_filename) {
  return { filename, status, ...(previous_filename ? { previous_filename } : {}) };
}

function historyCommit(index) {
  return index.toString(16).padStart(40, "0");
}

function historicalSnapshot(index, slug, owner = null) {
  return {
    commit: historyCommit(index),
    evalYaml: owner === null ? null : `id: ${slug}\nrunner: builtin\n`,
    authors: owner === null ? null : `@${owner}\n`,
  };
}

function snapshotKey(repository, sha, pathname) {
  return `${repository}@${sha}:${pathname}`;
}

function ownershipHistoryForBase(base) {
  const evalYamlPath = Object.keys(base).find((pathname) =>
    pathname.endsWith("/eval.yaml"),
  );
  if (evalYamlPath === undefined) {
    return {
      active: false,
      activeOwner: null,
      canonicalOwner: null,
      seen: false,
      violations: [],
    };
  }
  const authorsPath = `${evalYamlPath.slice(
    0,
    evalYamlPath.length - "eval.yaml".length,
  )}AUTHORS`;
  const owner =
    typeof base[authorsPath] === "string"
      ? base[authorsPath].trim().slice(1)
      : "snapshot-owner";
  return {
    active: true,
    activeOwner: owner,
    canonicalOwner: owner,
    seen: true,
    violations: [],
  };
}

async function evaluate({
  actor = "sample-author",
  body,
  changedFiles,
  base = {},
  head = {},
  ownershipHistory,
  ownershipHistoryError = null,
}) {
  const snapshots = new Map();
  for (const [pathname, contents] of Object.entries(base)) {
    snapshots.set(snapshotKey(baseRepository, baseSha, pathname), contents);
  }
  for (const [pathname, contents] of Object.entries(head)) {
    snapshots.set(snapshotKey(headRepository, headSha, pathname), contents);
  }
  return evaluatePullRequestPolicy({
    event: body === undefined ? makeEvent(actor) : makeEvent(actor, body),
    listChangedFiles: async () => changedFiles,
    readText: async (repository, sha, pathname) =>
      snapshots.get(snapshotKey(repository, sha, pathname)) ?? null,
    readOwnershipHistory: async () => {
      if (ownershipHistoryError !== null) throw ownershipHistoryError;
      return ownershipHistory === undefined
        ? ownershipHistoryForBase(base)
        : ownershipHistory;
    },
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
    body: submissionBody("new", "sample-eval"),
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
  assert.equal(result.submissionTask, taskId);
});

test("allows a new custom eval with an explicit mode and participant input", async () => {
  const result = await evaluate({
    body: submissionBody("new", "sample-eval"),
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
    body: submissionBody("update", "sample-eval"),
    changedFiles: [file("evals/sample-eval/README.md")],
    base: {
      "evals/sample-eval/AUTHORS": "@sample-author\n",
      "evals/sample-eval/eval.yaml": legacyDefinition,
    },
    head: { "evals/sample-eval/eval.yaml": legacyDefinition },
  });
  assert.equal(result.mode, "community-eval-update");
});

test("keeps a legacy custom eval restore backward-compatible", async () => {
  const legacyDefinition = `id: sample-eval
runner: custom
command_template:
  argv: [node, evals/sample-eval/pack.mjs, evals/sample-eval/tasks/example-submission.json, --out, "{output}"]
`;
  const result = await evaluate({
    body: submissionBody("update", "sample-eval"),
    changedFiles: [
      file("evals/sample-eval/AUTHORS", "added"),
      file("evals/sample-eval/eval.yaml", "added"),
    ],
    head: {
      "evals/sample-eval/AUTHORS": "@sample-author\n",
      "evals/sample-eval/eval.yaml": legacyDefinition,
    },
    ownershipHistory: {
      active: false,
      activeOwner: null,
      canonicalOwner: "sample-author",
      seen: true,
      violations: [],
    },
  });

  assert.equal(result.mode, "community-eval-restore");
  assert.equal(result.owner, "sample-author");
});

test("allows an author to update their own eval", async () => {
  const result = await evaluate({
    body: submissionBody("update", "sample-eval"),
    changedFiles: [file("evals/sample-eval/README.md")],
    base: {
      "evals/sample-eval/AUTHORS": "@sample-author\n",
      "evals/sample-eval/eval.yaml": "id: sample-eval\n",
    },
    head: { "evals/sample-eval/eval.yaml": "id: sample-eval\n" },
  });
  assert.equal(result.mode, "community-eval-update");
  assert.equal(result.submissionTask, taskId);
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

test("maintainer may create an eval owned by a GitHub org", async () => {
  const result = await evaluate({
    actor: MAINTAINER_LOGIN,
    changedFiles: [
      file("evals/org-owned/eval.yaml", "added"),
      file("evals/org-owned/AUTHORS", "added"),
    ],
    head: {
      "evals/org-owned/eval.yaml": "id: org-owned\nrunner: builtin\n",
      "evals/org-owned/AUTHORS": "@zlab-princeton\n",
    },
  });

  assert.equal(result.owner, "zlab-princeton");
  assert.equal(result.slug, "org-owned");
  assert.equal(result.mode, "community-eval-create");
});

test("RSIBench-style invalid restores do not overwrite canonical ownership", () => {
  const result = reduceOwnershipHistory("rsibench-data", [
    historicalSnapshot(1, "rsibench-data", MAINTAINER_LOGIN),
    // An active-to-active maintainer transfer establishes the new canonical owner.
    historicalSnapshot(2, "rsibench-data", "evolvent-ai"),
    historicalSnapshot(3, "rsibench-data"),
    // A deleted slug was incorrectly recreated under the maintainer account.
    historicalSnapshot(4, "rsibench-data", MAINTAINER_LOGIN),
    historicalSnapshot(5, "rsibench-data", MAINTAINER_LOGIN),
    historicalSnapshot(6, "rsibench-data"),
    // Repeating the bad restore still cannot rewrite the canonical owner.
    historicalSnapshot(7, "rsibench-data", MAINTAINER_LOGIN),
    historicalSnapshot(8, "rsibench-data"),
  ]);

  assert.equal(result.seen, true);
  assert.equal(result.active, false);
  assert.equal(result.canonicalOwner, "evolvent-ai");
  assert.equal(result.violations.length, 2);
  assert.deepEqual(
    result.violations.map(({ actualOwner, expectedOwner, type }) => ({
      actualOwner,
      expectedOwner,
      type,
    })),
    [
      {
        actualOwner: MAINTAINER_LOGIN,
        expectedOwner: "evolvent-ai",
        type: "restore_owner_mismatch",
      },
      {
        actualOwner: MAINTAINER_LOGIN,
        expectedOwner: "evolvent-ai",
        type: "restore_owner_mismatch",
      },
    ],
  );
});

test("preserves a legacy active-to-active ownership transfer as canonical", () => {
  const result = reduceOwnershipHistory("legacy-eval", [
    historicalSnapshot(1, "legacy-eval", MAINTAINER_LOGIN),
    // This transfer may predate today's standalone AUTHORS-only PR rule; the
    // trusted first-parent state transition remains authoritative history.
    historicalSnapshot(2, "legacy-eval", "upstream-org"),
  ]);

  assert.equal(result.active, true);
  assert.equal(result.activeOwner, "upstream-org");
  assert.equal(result.canonicalOwner, "upstream-org");
  assert.deepEqual(result.violations, []);
});

const deletedOrgOwnedHistory = {
  active: false,
  activeOwner: null,
  canonicalOwner: "evolvent-ai",
  seen: true,
  violations: [
    {
      actualOwner: MAINTAINER_LOGIN,
      commit: historyCommit(7),
      expectedOwner: "evolvent-ai",
      type: "restore_owner_mismatch",
    },
  ],
};

const activeWrongRestoredHistory = {
  active: true,
  activeOwner: "wrong-restorer",
  canonicalOwner: "evolvent-ai",
  seen: true,
  violations: [
    {
      actualOwner: "wrong-restorer",
      commit: historyCommit(9),
      expectedOwner: "evolvent-ai",
      type: "restore_owner_mismatch",
    },
  ],
};

test("rejects even a maintainer restore under a non-canonical owner", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      changedFiles: [
        file("evals/rsibench-data/eval.yaml", "added"),
        file("evals/rsibench-data/AUTHORS", "added"),
      ],
      head: {
        "evals/rsibench-data/eval.yaml":
          "id: rsibench-data\nrunner: builtin\n",
        "evals/rsibench-data/AUTHORS": `@${MAINTAINER_LOGIN}\n`,
      },
      ownershipHistory: deletedOrgOwnedHistory,
    },
    "restore_owner_mismatch",
  );
});

test("allows a canonical-owner restore with an update submission marker", async () => {
  const result = await evaluate({
    actor: MAINTAINER_LOGIN,
    body: submissionBody("update", "rsibench-data"),
    changedFiles: [
      file("evals/rsibench-data/eval.yaml", "added"),
      file("evals/rsibench-data/AUTHORS", "added"),
    ],
    head: {
      "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
      "evals/rsibench-data/AUTHORS": "@evolvent-ai\n",
    },
    ownershipHistory: deletedOrgOwnedHistory,
  });

  assert.equal(result.mode, "community-eval-restore");
  assert.equal(result.owner, "evolvent-ai");
  assert.equal(result.historicalOwnershipViolations, 1);
  assert.equal(result.submissionTask, taskId);
});

test("rejects a new submission marker for a restored slug", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      body: submissionBody("new", "rsibench-data"),
      changedFiles: [file("evals/rsibench-data/eval.yaml", "added")],
      head: {
        "evals/rsibench-data/eval.yaml":
          "id: rsibench-data\nrunner: builtin\n",
        "evals/rsibench-data/AUTHORS": "@evolvent-ai\n",
      },
      ownershipHistory: deletedOrgOwnedHistory,
    },
    "submission_marker_kind_mismatch",
  );
});

test("freezes content updates while an active eval has a non-canonical owner", async () => {
  await expectPolicyError(
    {
      actor: "wrong-restorer",
      body: submissionBody("update", "rsibench-data"),
      changedFiles: [file("evals/rsibench-data/README.md")],
      base: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
        "evals/rsibench-data/AUTHORS": "@wrong-restorer\n",
      },
      head: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
      },
      ownershipHistory: activeWrongRestoredHistory,
    },
    "ownership_repair_required",
  );
});

test("freezes maintainer proxy updates until active ownership is repaired", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      changedFiles: [file("evals/rsibench-data/README.md")],
      base: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
        "evals/rsibench-data/AUTHORS": "@wrong-restorer\n",
      },
      head: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
      },
      ownershipHistory: activeWrongRestoredHistory,
    },
    "ownership_repair_required",
  );
});

test("allows a maintainer-only standalone repair to the canonical owner", async () => {
  const result = await evaluate({
    actor: MAINTAINER_LOGIN,
    changedFiles: [file("evals/rsibench-data/AUTHORS")],
    base: {
      "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
      "evals/rsibench-data/AUTHORS": "@wrong-restorer\n",
    },
    head: {
      "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
      "evals/rsibench-data/AUTHORS": "@evolvent-ai\n",
    },
    ownershipHistory: activeWrongRestoredHistory,
  });

  assert.equal(result.mode, "community-eval-update");
  assert.equal(result.owner, "evolvent-ai");
  assert.equal(result.historicalOwnershipViolations, 1);
  assert.equal(result.submissionTask, null);
});

test("rejects a submission marker on an active ownership repair", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      body: submissionBody("update", "rsibench-data"),
      changedFiles: [file("evals/rsibench-data/AUTHORS")],
      base: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
        "evals/rsibench-data/AUTHORS": "@wrong-restorer\n",
      },
      head: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
        "evals/rsibench-data/AUTHORS": "@evolvent-ai\n",
      },
      ownershipHistory: activeWrongRestoredHistory,
    },
    "submission_marker_unexpected",
  );
});

test("rejects replacing an active ownership anomaly with a third owner", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      changedFiles: [file("evals/rsibench-data/AUTHORS")],
      base: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
        "evals/rsibench-data/AUTHORS": "@wrong-restorer\n",
      },
      head: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
        "evals/rsibench-data/AUTHORS": "@third-owner\n",
      },
      ownershipHistory: activeWrongRestoredHistory,
    },
    "ownership_repair_required",
  );
});

test("rejects ownership history whose active owner disagrees with base AUTHORS", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      changedFiles: [file("evals/rsibench-data/README.md")],
      base: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
        "evals/rsibench-data/AUTHORS": "@wrong-restorer\n",
      },
      head: {
        "evals/rsibench-data/eval.yaml": "id: rsibench-data\nrunner: builtin\n",
      },
      ownershipHistory: {
        ...activeWrongRestoredHistory,
        activeOwner: "someone-else",
      },
    },
    "ownership_history_invalid",
  );
});

test("fails closed when ownership history is unavailable", async () => {
  await expectPolicyError(
    {
      changedFiles: [file("evals/sample-eval/eval.yaml", "added")],
      head: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml":
          "id: sample-eval\nrunner: builtin\n",
      },
      ownershipHistoryError: new PullRequestPolicyError(
        "ownership_history_unavailable",
        "history unavailable",
      ),
    },
    "ownership_history_unavailable",
  );
});

test("fails closed on an active update when ownership history is unavailable", async () => {
  await expectPolicyError(
    {
      body: submissionBody("update", "sample-eval"),
      changedFiles: [file("evals/sample-eval/README.md")],
      base: {
        "evals/sample-eval/AUTHORS": "@sample-author\n",
        "evals/sample-eval/eval.yaml": "id: sample-eval\nrunner: builtin\n",
      },
      head: {
        "evals/sample-eval/eval.yaml": "id: sample-eval\nrunner: builtin\n",
      },
      ownershipHistoryError: new PullRequestPolicyError(
        "ownership_history_unavailable",
        "history unavailable",
      ),
    },
    "ownership_history_unavailable",
  );
});

test("fails closed on an unparseable historical AUTHORS file", () => {
  assert.throws(
    () =>
      reduceOwnershipHistory("sample-eval", [
        {
          ...historicalSnapshot(1, "sample-eval", "sample-author"),
          authors: "not-a-handle\n",
        },
      ]),
    (error) =>
      error instanceof PullRequestPolicyError &&
      error.code === "ownership_history_invalid",
  );
});

test("fails closed when the trusted checkout is shallow", async () => {
  await assert.rejects(
    readOwnershipHistoryFromGit({
      repoRoot: "/trusted",
      baseSha: "a".repeat(40),
      slug: "sample-eval",
      runGit: async (_repoRoot, args) => {
        assert.deepEqual(args, ["rev-parse", "--is-shallow-repository"]);
        return Buffer.from("true\n");
      },
    }),
    (error) =>
      error instanceof PullRequestPolicyError &&
      error.code === "ownership_history_shallow",
  );
});

test("fails closed when trusted checkout HEAD differs from the base SHA", async () => {
  const trustedBaseSha = "a".repeat(40);
  const calls = [];
  await assert.rejects(
    readOwnershipHistoryFromGit({
      repoRoot: "/trusted",
      baseSha: trustedBaseSha,
      slug: "sample-eval",
      runGit: async (_repoRoot, args) => {
        calls.push(args);
        if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") {
          return Buffer.from("false\n");
        }
        if (args[0] === "rev-parse" && args[1] === "--verify") {
          return Buffer.from(`${trustedBaseSha}\n`);
        }
        if (args[0] === "rev-parse" && args[1] === "HEAD") {
          return Buffer.from(`${"b".repeat(40)}\n`);
        }
        assert.fail(`unexpected git invocation: ${args.join(" ")}`);
      },
    }),
    (error) =>
      error instanceof PullRequestPolicyError &&
      error.code === "ownership_history_unavailable",
  );
  assert.deepEqual(calls, [
    ["rev-parse", "--is-shallow-repository"],
    ["rev-parse", "--verify", `${trustedBaseSha}^{commit}`],
    ["rev-parse", "HEAD"],
  ]);
});

test("replays the trusted first-parent git transcript into ownership state", async () => {
  const trustedBaseSha = "a".repeat(40);
  const createCommit = "1".repeat(40);
  const transferCommit = "2".repeat(40);
  const evalYamlPath = "evals/sample-eval/eval.yaml";
  const authorsPath = "evals/sample-eval/AUTHORS";
  const responses = new Map([
    [["rev-parse", "--is-shallow-repository"].join("\0"), "false\n"],
    [
      ["rev-parse", "--verify", `${trustedBaseSha}^{commit}`].join("\0"),
      `${trustedBaseSha}\n`,
    ],
    [["rev-parse", "HEAD"].join("\0"), `${trustedBaseSha}\n`],
    [
      [
        "rev-list",
        "--first-parent",
        "--reverse",
        trustedBaseSha,
        "--",
        evalYamlPath,
        authorsPath,
      ].join("\0"),
      `${createCommit}\n${transferCommit}\n`,
    ],
  ]);
  for (const [commit, owner] of [
    [createCommit, MAINTAINER_LOGIN],
    [transferCommit, "upstream-org"],
  ]) {
    responses.set(
      ["ls-tree", "--name-only", commit, "--", evalYamlPath].join("\0"),
      `${evalYamlPath}\n`,
    );
    responses.set(
      ["ls-tree", "--name-only", commit, "--", authorsPath].join("\0"),
      `${authorsPath}\n`,
    );
    responses.set(
      ["show", "--no-ext-diff", "--no-textconv", `${commit}:${evalYamlPath}`].join("\0"),
      "id: sample-eval\nrunner: builtin\n",
    );
    responses.set(
      ["show", "--no-ext-diff", "--no-textconv", `${commit}:${authorsPath}`].join("\0"),
      `@${owner}\n`,
    );
  }

  const result = await readOwnershipHistoryFromGit({
    repoRoot: "/trusted",
    baseSha: trustedBaseSha,
    slug: "sample-eval",
    runGit: async (_repoRoot, args) => {
      const response = responses.get(args.join("\0"));
      assert.notEqual(response, undefined, `unexpected git invocation: ${args.join(" ")}`);
      return Buffer.from(response);
    },
  });

  assert.equal(result.active, true);
  assert.equal(result.activeOwner, "upstream-org");
  assert.equal(result.canonicalOwner, "upstream-org");
  assert.deepEqual(result.violations, []);
});

test("maintainer may reassign AUTHORS of an existing eval", async () => {
  const result = await evaluate({
    actor: MAINTAINER_LOGIN,
    changedFiles: [file("evals/ceo-bench/AUTHORS")],
    base: {
      "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n",
      "evals/ceo-bench/AUTHORS": `@${MAINTAINER_LOGIN}\n`,
    },
    head: {
      "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n",
      "evals/ceo-bench/AUTHORS": "@zlab-princeton\n",
    },
  });

  assert.equal(result.slug, "ceo-bench");
  // owner/mode 报的是合入后的归属：迁移走了就不再算官方评测。
  assert.equal(result.owner, "zlab-princeton");
  assert.equal(result.mode, "community-eval-update");
});

test("rejects mixing an active ownership transfer with eval content", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      changedFiles: [
        file("evals/ceo-bench/AUTHORS"),
        file("evals/ceo-bench/README.md"),
      ],
      base: {
        "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n",
        "evals/ceo-bench/AUTHORS": `@${MAINTAINER_LOGIN}\n`,
      },
      head: {
        "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n",
        "evals/ceo-bench/AUTHORS": "@zlab-princeton\n",
      },
    },
    "ownership_transfer_mixed_with_content",
  );
});

test("rejects a submission marker on a standalone ownership transfer", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      body: submissionBody("update", "ceo-bench"),
      changedFiles: [file("evals/ceo-bench/AUTHORS")],
      base: {
        "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n",
        "evals/ceo-bench/AUTHORS": `@${MAINTAINER_LOGIN}\n`,
      },
      head: {
        "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n",
        "evals/ceo-bench/AUTHORS": "@zlab-princeton\n",
      },
    },
    "submission_marker_unexpected",
  );
});

// AUTHORS 变更后 owner 改读 head，因此「只删 AUTHORS、留下 eval.yaml」这条路不再
// 落回 base 归属，而是明确报缺文件：已存在的评测集必须始终带 AUTHORS。
test("rejects dropping AUTHORS from an eval that still exists", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      changedFiles: [file("evals/ceo-bench/AUTHORS", "removed")],
      base: {
        "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n",
        "evals/ceo-bench/AUTHORS": "@zlab-princeton\n",
      },
      head: { "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n" },
    },
    "required_file_missing",
  );
});

test("maintainer may update an eval owned by someone else", async () => {
  const result = await evaluate({
    actor: MAINTAINER_LOGIN,
    changedFiles: [file("evals/ceo-bench/eval.yaml")],
    base: {
      "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n",
      "evals/ceo-bench/AUTHORS": "@zlab-princeton\n",
    },
    head: { "evals/ceo-bench/eval.yaml": "id: ceo-bench\nrunner: builtin\n" },
  });

  assert.equal(result.owner, "zlab-princeton");
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
  assert.equal(result.submissionTask, null);
});

const createChangedFiles = [
  file("evals/sample-eval/AUTHORS", "added"),
  file("evals/sample-eval/eval.yaml", "added"),
];
const createHead = {
  "evals/sample-eval/AUTHORS": "@sample-author\n",
  "evals/sample-eval/eval.yaml": "id: sample-eval\nrunner: builtin\n",
};
const updateBase = {
  "evals/sample-eval/AUTHORS": "@sample-author\n",
  "evals/sample-eval/eval.yaml": "id: sample-eval\n",
};
const updateHead = { "evals/sample-eval/eval.yaml": "id: sample-eval\n" };

function createOptions(body) {
  return { body, changedFiles: createChangedFiles, head: createHead };
}

function updateOptions(body) {
  return {
    body,
    changedFiles: [file("evals/sample-eval/README.md")],
    base: updateBase,
    head: updateHead,
  };
}

test("rejects a community submission that never pasted the marker", async () => {
  await expectPolicyError(
    createOptions("AUTHORS: @sample-author\n"),
    "submission_marker_required",
  );
  await expectPolicyError(
    updateOptions("AUTHORS: @sample-author\n"),
    "submission_marker_required",
  );
});

test("rejects an empty or missing body on a community submission", async () => {
  await expectPolicyError(createOptions(""), "submission_marker_required");
  await expectPolicyError(createOptions(null), "submission_marker_required");
});

test("rejects a non-text pull request body instead of scanning it", async () => {
  await expectPolicyError(createOptions(42), "invalid_pull_request_body");
});

test("rejects a body larger than the policy scan limit", async () => {
  await expectPolicyError(
    createOptions(`${marker("new", "sample-eval")}${"x".repeat(262_145)}`),
    "invalid_pull_request_body",
  );
});

test("separates a mistyped marker from a missing one", async () => {
  const mistyped = [
    "<!--evalhub-submission task=evaltask_243e0b48-c968-4968-80ee-29221bde6cff kind=new slug=sample-eval -->",
    `<!-- evalhub-submission task=${taskId} kind=created slug=sample-eval -->`,
    `<!-- evalhub-submission task=${taskId}  kind=new slug=sample-eval -->`,
    "<!-- evalhub-submission task=evaltask_not-a-uuid kind=new slug=sample-eval -->",
    `<!-- evalhub-submission task=${taskId} kind=new -->`,
  ];
  for (const body of mistyped) {
    await expectPolicyError(createOptions(body), "submission_marker_malformed");
  }
});

test("rejects two markers because the platform binds only the first", async () => {
  await expectPolicyError(
    createOptions(
      `${marker("new", "sample-eval")}\n${marker("new", "sample-eval", otherTaskId)}\n`,
    ),
    "submission_marker_duplicated",
  );
});

test("rejects a valid marker shadowed by an unparseable one", async () => {
  await expectPolicyError(
    createOptions(
      `${marker("new", "sample-eval")}\n<!-- evalhub-submission task=broken -->\n`,
    ),
    "submission_marker_malformed",
  );
});

test("rejects a marker that points at a different eval", async () => {
  await expectPolicyError(
    createOptions(submissionBody("new", "other-eval")),
    "submission_marker_slug_mismatch",
  );
});

test("rejects a marker whose kind contradicts the change", async () => {
  await expectPolicyError(
    createOptions(submissionBody("update", "sample-eval")),
    "submission_marker_kind_mismatch",
  );
  await expectPolicyError(
    updateOptions(submissionBody("new", "sample-eval")),
    "submission_marker_kind_mismatch",
  );
});

test("rejects a marker on a maintenance or delete pull request", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      body: submissionBody("update", "sample-eval"),
      changedFiles: [file("README.md")],
    },
    "submission_marker_unexpected",
  );
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      body: submissionBody("update", "sample-eval"),
      changedFiles: [file("evals/sample-eval/eval.yaml", "removed")],
      base: updateBase,
    },
    "submission_marker_unexpected",
  );
});

test("keeps the marker optional for maintainer-authored submissions", async () => {
  const result = await evaluate({
    actor: MAINTAINER_LOGIN,
    body: "AUTHORS: @sample-author\n",
    ...updateOptions("AUTHORS: @sample-author\n"),
  });
  assert.equal(result.mode, "community-eval-update");
  assert.equal(result.submissionTask, null);
});

test("still validates a marker the maintainer chose to include", async () => {
  await expectPolicyError(
    {
      actor: MAINTAINER_LOGIN,
      ...updateOptions(submissionBody("update", "other-eval")),
    },
    "submission_marker_slug_mismatch",
  );
});

test("lets pre-existing policy rejections win over marker enforcement", async () => {
  await expectPolicyError(
    {
      actor: "third-party",
      ...updateOptions("AUTHORS: @sample-author\n"),
    },
    "third_party_update_forbidden",
  );
});
