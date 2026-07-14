import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateRepository } from "../validate.mjs";

const validEval = {
  id: "sample-eval",
  name: "Sample eval",
  category: "useful",
  description: "A standalone validation fixture.",
  dimensions: ["语言"],
  interface: "chat",
  runner: "builtin",
  scoring: "exact",
  scored_by: "local",
  tasks: [{ id: "one", prompt: "Say yes", expected: "yes" }],
};

const validResult = {
  eval_id: "sample-eval",
  submission: {
    runner_version: "fixture-1.0.0",
    run_date: "2026-07-10",
  },
  results: [
    {
      participant: { model: "vendor/model-20260710" },
      score: 100,
    },
  ],
};

const validEvalYaml = `id: sample-eval
name: Sample eval
category: useful
description: A standalone validation fixture.
dimensions:
  - 语言
interface: chat
runner: builtin
scoring: exact
scored_by: local
tasks:
  - id: one
    prompt: Say yes
    expected: yes
`;

async function makeFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "evalhub-template-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const evalDir = path.join(root, "evals", validEval.id);
  await mkdir(path.join(root, ".github"), { recursive: true });
  await mkdir(path.join(evalDir, "tasks"), { recursive: true });
  await mkdir(path.join(evalDir, "assets"));
  await Promise.all([
    writeFile(
      path.join(root, ".github", "CODEOWNERS"),
      "/evals/sample-eval/ @sample-author\n",
    ),
    writeFile(path.join(evalDir, "eval.yaml"), validEvalYaml),
    writeFile(path.join(evalDir, "README.md"), "# Sample eval\n"),
    writeFile(path.join(evalDir, "AUTHORS"), "@sample-author\n"),
    writeFile(
      path.join(evalDir, "sample-result.json"),
      `${JSON.stringify(validResult, null, 2)}\n`,
    ),
    writeFile(path.join(evalDir, "tasks", "README.md"), "# Tasks\n"),
    writeFile(path.join(evalDir, "assets", "README.md"), "# Assets\n"),
  ]);

  return { root, evalDir };
}

async function getValidationError(root) {
  try {
    await validateRepository(root);
  } catch (error) {
    assert.equal(error.name, "RepositoryValidationError");
    return error;
  }
  assert.fail("expected repository validation to fail");
}

async function expectInvalid(root, ...messages) {
  const error = await getValidationError(root);
  for (const message of messages) {
    assert.match(error.message, message);
  }
}

test("exports a repository validator without running the CLI", async () => {
  const module = await import("../validate.mjs");

  assert.equal(typeof module.validateRepository, "function");
});

test("validates a complete repository with the shared contracts", async (t) => {
  const { root } = await makeFixture(t);

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

test("reports a missing CODEOWNERS root once without missing-rule cascades", async (t) => {
  const { root } = await makeFixture(t);
  const codeownersPath = path.join(root, ".github", "CODEOWNERS");
  await rm(codeownersPath);

  const error = await getValidationError(root);

  assert.equal(error.errors.length, 1);
  assert.equal(
    error.errors[0],
    `${codeownersPath}\n.github/CODEOWNERS: required path is missing`,
  );
  assert.doesNotMatch(error.message, /exact rule is missing/);
});

test("reports an empty CODEOWNERS root once without missing-rule cascades", async (t) => {
  const { root } = await makeFixture(t);
  const codeownersPath = path.join(root, ".github", "CODEOWNERS");
  await writeFile(codeownersPath, " \n\t");

  const error = await getValidationError(root);

  assert.equal(error.errors.length, 1);
  assert.equal(
    error.errors[0],
    `${codeownersPath}\n.github/CODEOWNERS: required file must be non-empty`,
  );
  assert.doesNotMatch(error.message, /exact rule is missing/);
});

test("reports a non-file CODEOWNERS root once without missing-rule cascades", async (t) => {
  const { root } = await makeFixture(t);
  const codeownersPath = path.join(root, ".github", "CODEOWNERS");
  await rm(codeownersPath);
  await mkdir(codeownersPath);

  const error = await getValidationError(root);

  assert.equal(error.errors.length, 1);
  assert.equal(
    error.errors[0],
    `${codeownersPath}\n.github/CODEOWNERS: required path must be a file`,
  );
  assert.doesNotMatch(error.message, /exact rule is missing/);
});

test("requires one exact CODEOWNERS rule for every eval directory", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(path.join(root, ".github", "CODEOWNERS"), "# no eval rules\n\n");

  await expectInvalid(
    root,
    /CODEOWNERS\n\/evals\/sample-eval\/: exact rule is missing/,
  );
});

test("reports duplicate exact CODEOWNERS rules with their line numbers", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "/evals/sample-eval/ @sample-author\n/evals/sample-eval/ @sample-author\n",
  );

  await expectInvalid(
    root,
    /\/evals\/sample-eval\/: duplicate exact rules at lines 1, 2/,
  );
});

test("requires the CODEOWNERS handle to byte-match AUTHORS", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "/evals/sample-eval/ @different-owner\n",
  );

  await expectInvalid(
    root,
    /\/evals\/sample-eval\/: owner @different-owner does not match AUTHORS @sample-author/,
  );
});

test("rejects multiple owners on one exact CODEOWNERS rule", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "/evals/sample-eval/ @sample-author @second-owner\n",
  );

  await expectInvalid(
    root,
    /CODEOWNERS\nline 1: expected exactly two tokens \(pattern and one owner\)/,
  );
});

for (const [name, rule] of [
  ["wildcard", "/evals/*/ @sample-author\n"],
  ["non-anchored", "evals/sample-eval/ @sample-author\n"],
  ["missing trailing slash", "/evals/sample-eval @sample-author\n"],
]) {
  test(`rejects a ${name} CODEOWNERS pattern`, async (t) => {
    const { root } = await makeFixture(t);
    await writeFile(path.join(root, ".github", "CODEOWNERS"), rule);

    await expectInvalid(
      root,
      /CODEOWNERS\nline 1: eval ownership pattern must be an exact \/evals\/<slug>\/ path without wildcards/,
    );
  });
}

test("allows comments and blank lines around one synchronized owner", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "# Exact eval owners\n\n/evals/sample-eval/ @sample-author\n",
  );
  await writeFile(
    path.join(evalDir, "AUTHORS"),
    "# Primary maintainer\n\n  @sample-author  \n",
  );

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

test("allows unrelated CODEOWNERS patterns outside the root eval tree", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "/docs/evals/ @docs-owner\n/evals/sample-eval/ @sample-author\n",
  );

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

test("rejects a later global CODEOWNERS rule that overrides an exact eval owner", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "/evals/sample-eval/ @sample-author\n* @different-owner\n",
  );

  await expectInvalid(
    root,
    /\/evals\/sample-eval\/: effective owner @different-owner from line 2 does not match AUTHORS @sample-author/,
  );
});

test("allows a global CODEOWNERS rule before the exact eval owner", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "* @different-owner\n/evals/sample-eval/ @sample-author\n",
  );

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

for (const { label, pattern, nestedPath } of [
  {
    label: "YAML",
    pattern: "*.yaml",
    nestedPath: ["tasks", "nested", "case.yaml"],
  },
  {
    label: "Markdown",
    pattern: "*.md",
    nestedPath: ["tasks", "nested", "guide.md"],
  },
]) {
  test(`rejects a later global ${label} rule that overrides real eval files`, async (t) => {
    const { root, evalDir } = await makeFixture(t);
    const nestedFile = path.join(evalDir, ...nestedPath);
    await mkdir(path.dirname(nestedFile), { recursive: true });
    await writeFile(nestedFile, `# Nested ${label} fixture\n`);
    await writeFile(
      path.join(root, ".github", "CODEOWNERS"),
      `/evals/sample-eval/ @sample-author\n${pattern} @different-owner\n`,
    );

    const error = await getValidationError(root);
    const repositoryPath = ["evals", validEval.id, ...nestedPath].join("/");

    assert.match(
      error.message,
      new RegExp(
        `${repositoryPath.replaceAll(".", "\\.")}: effective owner @different-owner from line 2 does not match AUTHORS @sample-author`,
      ),
    );
  });

  test(`allows a global ${label} rule before the exact eval owner`, async (t) => {
    const { root, evalDir } = await makeFixture(t);
    const nestedFile = path.join(evalDir, ...nestedPath);
    await mkdir(path.dirname(nestedFile), { recursive: true });
    await writeFile(nestedFile, `# Nested ${label} fixture\n`);
    await writeFile(
      path.join(root, ".github", "CODEOWNERS"),
      `${pattern} @different-owner\n/evals/sample-eval/ @sample-author\n`,
    );

    assert.deepEqual(await validateRepository(root), {
      evalCount: 1,
      evalIds: ["sample-eval"],
    });
  });
}

for (const [name, authors, message] of [
  ["comments-only", "# no owner yet\n\n", /found 0/],
  ["multiple-line", "@sample-author\n@second-owner\n", /found 2/],
  ["scaffold placeholder", "@TODO-github-handle\n", /scaffold placeholder/],
  ["TODO text", "TODO\n", /must be one GitHub handle/],
  ["email", "owner@example.invalid\n", /must be one GitHub handle/],
  ["malformed handle", "@bad--handle\n", /must be one GitHub handle/],
]) {
  test(`rejects ${name} AUTHORS content`, async (t) => {
    const { root, evalDir } = await makeFixture(t);
    await writeFile(path.join(evalDir, "AUTHORS"), authors);

    const error = await getValidationError(root);

    assert.match(error.message, message);
    assert.doesNotMatch(error.message, /does not match AUTHORS/);
  });
}

test("suppresses derivative owner errors when AUTHORS is absent", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const authorsPath = path.join(evalDir, "AUTHORS");
  await rm(authorsPath);

  const error = await getValidationError(root);

  assert.equal(error.errors.length, 1);
  assert.equal(
    error.errors[0],
    `${authorsPath}\nAUTHORS: required path is missing`,
  );
  assert.doesNotMatch(error.message, /does not match AUTHORS/);
});

test("checks ownership even when eval.yaml is malformed", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(path.join(evalDir, "eval.yaml"), "id: [\n");
  await writeFile(path.join(evalDir, "AUTHORS"), "TODO\n");
  await writeFile(path.join(root, ".github", "CODEOWNERS"), "# no eval rules\n");

  await expectInvalid(
    root,
    /AUTHORS\nAUTHORS: meaningful line must be one GitHub handle/,
    /CODEOWNERS\n\/evals\/sample-eval\/: exact rule is missing/,
    /eval\.yaml/,
  );
});

test("validates a fully synchronized new eval directory", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const secondDir = path.join(root, "evals", "second-eval");
  await cp(evalDir, secondDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(secondDir, "eval.yaml"),
      validEvalYaml.replace("id: sample-eval", "id: second-eval"),
    ),
    writeFile(path.join(secondDir, "AUTHORS"), "@second-owner\n"),
    writeFile(
      path.join(secondDir, "sample-result.json"),
      `${JSON.stringify({ ...validResult, eval_id: "second-eval" }, null, 2)}\n`,
    ),
    writeFile(
      path.join(root, ".github", "CODEOWNERS"),
      "/evals/sample-eval/ @sample-author\n/evals/second-eval/ @second-owner\n",
    ),
  ]);

  assert.deepEqual(await validateRepository(root), {
    evalCount: 2,
    evalIds: ["sample-eval", "second-eval"],
  });
});

for (const requiredPath of [
  "README.md",
  "AUTHORS",
  "sample-result.json",
  "tasks",
  "assets",
]) {
  test(`rejects a missing ${requiredPath}`, async (t) => {
    const { root, evalDir } = await makeFixture(t);
    await rm(path.join(evalDir, requiredPath), { recursive: true, force: true });

    await expectInvalid(
      root,
      new RegExp(`${requiredPath.replace(".", "\\.")}: required path is missing`),
    );
  });
}

for (const requiredFile of [
  "eval.yaml",
  "README.md",
  "AUTHORS",
  "sample-result.json",
]) {
  test(`rejects an empty ${requiredFile}`, async (t) => {
    const { root, evalDir } = await makeFixture(t);
    await writeFile(path.join(evalDir, requiredFile), " \n\t");

    await expectInvalid(
      root,
      new RegExp(`${requiredFile.replace(".", "\\.")}: required file must be non-empty`),
    );
  });
}

for (const requiredDirectory of ["tasks", "assets"]) {
  test(`rejects ${requiredDirectory} when it is not a directory`, async (t) => {
    const { root, evalDir } = await makeFixture(t);
    const target = path.join(evalDir, requiredDirectory);
    await rm(target, { recursive: true });
    await writeFile(target, "not a directory\n");

    await expectInvalid(
      root,
      new RegExp(`${requiredDirectory}: required path must be a directory`),
    );
  });
}

test("rejects an eval id that does not equal its directory name", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    validEvalYaml.replace("id: sample-eval", "id: different-id"),
  );

  await expectInvalid(
    root,
    /eval\.yaml\nid: must equal directory name "sample-eval"/,
  );
});

test("rejects duplicate eval ids", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const duplicateDir = path.join(root, "evals", "duplicate-eval");
  await cp(evalDir, duplicateDir, { recursive: true });

  await expectInvalid(root, /eval\.yaml\nid: duplicate eval id "sample-eval"/);
});

test("reports the shared path for malformed nested command_template", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    validEvalYaml
      .replace("runner: builtin", "runner: custom")
      .replace(
        "scoring: exact",
        `command_template:
  argv:
    - node
    - run.mjs
    - --out
    - prefix-{output}
  output: sample-eval-result.json
scoring: exact`,
      ),
  );

  await expectInvalid(
    root,
    /command_template\.argv\.3: \{output\} 必须是独立的 argv token/,
  );
});

test("reports exact shared issue paths for the sibling result envelope", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const invalidResult = structuredClone(validResult);
  invalidResult.eval_id = "other-eval";
  invalidResult.results[0].participant.harness = "chat-harness";
  invalidResult.results[0].participant.harness_version = "1.0.0";
  await writeFile(
    path.join(evalDir, "sample-result.json"),
    `${JSON.stringify(invalidResult, null, 2)}\n`,
  );

  await expectInvalid(
    root,
    /eval_id: result eval_id must match eval\.id "sample-eval"/,
    /results\.0\.participant\.harness: interface=chat participants cannot include harness/,
  );
});
