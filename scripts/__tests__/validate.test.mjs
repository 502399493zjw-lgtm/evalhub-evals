import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildAgentBrief,
  EvalDefSchema,
} from "@evalhub/schemas";
import { loadModelRegistry } from "../model-contract.mjs";
import { validateRepository } from "../validate.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const vendoredModelRegistry = path.join(
  repositoryRoot,
  "vendor/evalhub-models/registry.json",
);

// published-results 的 participant.model 现在要过平台注册表，所以夹具不能再用编造
// 的名字。从快照里现取两个真实身份，快照换代时夹具跟着走，不用手改。
const [KNOWN_MODEL_A, KNOWN_MODEL_B] = (await loadModelRegistry()).models
  .filter((model) => !model.deprecated)
  .map((model) => model.modelId);

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

function makePublishedResult(
  sourceUrl = "https://example.com/official-results",
  sourceMetadata = {},
) {
  return {
    eval_id: "sample-eval",
    submission: {
      kind: "upstream_author_publication",
      importer_version: "1.0.0",
      retrieved_on: "2026-08-01",
      source: {
        url: sourceUrl,
        snapshot_sha256: "a".repeat(64),
        ...sourceMetadata,
      },
    },
    results: [
      {
        participant: { model: KNOWN_MODEL_A },
        score: 88,
      },
    ],
  };
}

function makeSharedViewResult(
  model,
  view,
  sourceUrl = "https://example.com/official-results",
  snapshotSha256 = "a".repeat(64),
) {
  return {
    eval_id: "sample-eval",
    submission: {
      kind: "upstream_author_publication",
      importer_version: "1.0.0",
      retrieved_on: "2026-08-01",
      source: {
        url: sourceUrl,
        snapshot_sha256: snapshotSha256,
      },
    },
    results: [
      {
        participant: { model },
        score: 88,
        supplementary_views: [view],
      },
    ],
  };
}

async function writePublishedResult(filePath, targetBytes) {
  const source = JSON.stringify(makePublishedResult());
  assert.ok(source.length <= targetBytes);
  await writeFile(filePath, `${source}${" ".repeat(targetBytes - source.length)}`);
}

async function makeFixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "evalhub-template-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const evalDir = path.join(root, "evals", validEval.id);
  await mkdir(path.join(root, ".github"), { recursive: true });
  await mkdir(path.join(root, "vendor", "evalhub-models"), { recursive: true });
  await mkdir(path.join(evalDir, "tasks"), { recursive: true });
  await mkdir(path.join(evalDir, "assets"));
  await Promise.all([
    cp(
      vendoredModelRegistry,
      path.join(root, "vendor", "evalhub-models", "registry.json"),
    ),
    writeFile(
      path.join(root, ".github", "CODEOWNERS"),
      "* @502399493zjw-lgtm\n",
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

test("vendored schemas expose an unavailable brief for evals without a pinned GitHub upstream", () => {
  const definition = EvalDefSchema.parse(validEval);
  const brief = buildAgentBrief(definition, {
    siteOrigin: "https://evalhub.example",
    cliPackageSpec: "@evalhub/cli",
  });

  assert.match(brief, /^---\nschema: evalhub-run-brief\/unavailable\/v1/m);
  assert.match(brief, /当前无法生成运行评测 Brief/);
  assert.match(brief, /一个公开的 GitHub upstream 仓库/);
  assert.match(brief, /不会安装、运行、转换或处理结果/);
});

test("validates a complete repository with the shared contracts", async (t) => {
  const { root } = await makeFixture(t);

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

test("requires a published numeric baseline when baseline_policy is required", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    `${validEvalYaml}score_policy: required\nbaseline_policy: required\n`,
  );

  await expectInvalid(root, /baseline_policy=required requires at least one published-results/);
});

test("rejects a null published baseline before merge", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    `${validEvalYaml}score_policy: required\nbaseline_policy: required\n`,
  );
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "official.json"),
    `${JSON.stringify({
      eval_id: "sample-eval",
      submission: {
        kind: "upstream_author_publication",
        importer_version: "1.0.0",
        retrieved_on: "2026-08-01",
        source: {
          url: "https://example.com/official-results",
          snapshot_sha256: "a".repeat(64),
        },
      },
      results: [
        {
          participant: { model: KNOWN_MODEL_A },
          score: null,
        },
      ],
    }, null, 2)}\n`,
  );

  await expectInvalid(
    root,
    /upstream_author_publication submissions must include a non-null score/,
    /score_policy=required.*score.*null/,
  );
});

// 2026-08-07 事故的形态：投稿仓库合进了一个平台解析不了的 participant.model，
// 直到 push 到 main 之后才在内容同步 webhook 里以 partial_sync 炸开。
test("rejects a published participant.model the platform cannot resolve", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "official.json"),
    `${JSON.stringify(makePublishedResult(), null, 2).replace(
      JSON.stringify(KNOWN_MODEL_A),
      JSON.stringify("Gemini 3 Flash"),
    )}\n`,
  );

  await expectInvalid(
    root,
    /results\[0\]\.participant\.model: "Gemini 3 Flash" 不在平台模型注册表中/u,
    /建议改用：.*google\/gemini-3-flash-preview/u,
  );
});

// 判定用的是 validator 自己那份快照，社区 PR 自带一份"放行自己"的 registry.json
// 不能生效；被审那份只要被手改就必须报出来。
test("rejects a hand-edited vendored model registry snapshot", async (t) => {
  const { root } = await makeFixture(t);
  const snapshot = path.join(root, "vendor", "evalhub-models", "registry.json");
  const tampered = JSON.parse(await readFile(snapshot, "utf8"));
  tampered.aliases.push({
    alias: "Gemini 3 Flash",
    normalizedAlias: "gemini-3-flash",
    canonicalModelId: "google/gemini-3-flash-preview",
  });
  await writeFile(snapshot, `${JSON.stringify(tampered, null, 2)}\n`);

  await expectInvalid(root, /sourceSha256 与内容不符/u, /不要手改快照/u);
});

test("accepts a reviewed published baseline with structured component metrics", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    `${validEvalYaml}score_policy: required\nbaseline_policy: required\n`,
  );
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "official.json"),
    `${JSON.stringify({
      ...makePublishedResult("https://example.com/official-results", {
        official_result_count: 1,
      }),
      results: [
        {
          participant: { model: KNOWN_MODEL_A },
          score: 88,
          supplementary_views: [
            {
              type: "metric_table",
              title: "Components",
              columns: ["Component", "Score"],
              rows: [{ cells: ["Language", 88] }],
            },
          ],
        },
      ],
    }, null, 2)}\n`,
  );

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

test("rejects a shared supplementary view id whose metadata drifts across participants", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    `${validEvalYaml}score_policy: required\nbaseline_policy: required\n`,
  );
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "a-official.json"),
    `${JSON.stringify(
      makeSharedViewResult(KNOWN_MODEL_A, {
        type: "metric_table",
        id: "official-breakdown",
        label: "分项",
        title: "Components",
        columns: ["Component", "Score"],
        rows: [{ cells: ["Language", 88] }],
      }),
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(directory, "b-official.json"),
    `${JSON.stringify(
      makeSharedViewResult(KNOWN_MODEL_B, {
        type: "metric_table",
        id: "official-breakdown",
        label: "分项",
        title: "Component scores",
        columns: ["Component", "Score"],
        rows: [{ cells: ["Language", 74] }],
      }),
      null,
      2,
    )}\n`,
  );

  await expectInvalid(
    root,
    /supplementary view "official-breakdown" must keep the same type, title, label, and columns or axis labels across every published participant/,
    /first defined at .*a-official\.json \(results\.0\.supplementary_views\.0\.id\)/,
  );
});

test("accepts a shared supplementary view id whose rows differ per participant", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    `${validEvalYaml}score_policy: required\nbaseline_policy: required\n`,
  );
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  for (const [name, model, value] of [
    ["a-official.json", KNOWN_MODEL_A, 88],
    ["b-official.json", KNOWN_MODEL_B, 74],
  ]) {
    const sourceUrl = `https://example.com/official-results/${name}`;
    await writeFile(
      path.join(directory, name),
      `${JSON.stringify(
        makeSharedViewResult(model, {
          type: "metric_table",
          id: "official-breakdown",
          label: "分项",
          title: "Components",
          columns: ["Component", "Score"],
          rows: [{ cells: ["Language", value] }],
        }, sourceUrl),
        null,
        2,
      )}\n`,
    );
  }

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

test("accepts a legacy published result without coverage metadata during migration", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "legacy.json"),
    `${JSON.stringify(makePublishedResult(), null, 2)}\n`,
  );

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

test("accepts official result coverage with omitted unregistered models", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "official.json"),
    `${JSON.stringify(
      makePublishedResult("https://example.com/official-results", {
        official_result_count: 3,
        omitted_models: [
          { model: "vendor/unregistered-model-a", reason: "unregistered" },
          { model: "vendor/unregistered-model-b", reason: "unregistered" },
        ],
      }),
      null,
      2,
    )}\n`,
  );

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

test("rejects an official result coverage count that does not match the envelope", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "official.json"),
    `${JSON.stringify(
      makePublishedResult("https://example.com/official-results", {
        official_result_count: 2,
      }),
      null,
      2,
    )}\n`,
  );

  await expectInvalid(
    root,
    /source\.official_result_count must equal results\.length \+ omitted_models\.length/,
  );
});

test("rejects an omitted model that is also present in results", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "official.json"),
    `${JSON.stringify(
      makePublishedResult("https://example.com/official-results", {
        official_result_count: 2,
        omitted_models: [
          { model: KNOWN_MODEL_A, reason: "unregistered" },
        ],
      }),
      null,
      2,
    )}\n`,
  );

  await expectInvalid(
    root,
    /omitted_models cannot include a model present in results/,
  );
});

test("rejects splitting one official source snapshot across result files", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await Promise.all(
    ["a-official.json", "b-official.json"].map((name) =>
      writeFile(
        path.join(directory, name),
        `${JSON.stringify(makePublishedResult(), null, 2)}\n`,
      ),
    ),
  );

  await expectInvalid(
    root,
    /published-results cannot contain the same official source in multiple JSON files/,
  );
});

test("rejects credentials embedded in a published result source URL", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    `${validEvalYaml}score_policy: required\nbaseline_policy: required\n`,
  );
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "official.json"),
    `${JSON.stringify(
      makePublishedResult("https://user:password@example.com/results"),
      null,
      2,
    )}\n`,
  );

  await expectInvalid(
    root,
    /source\.url must use https without embedded credentials/,
  );
});

test("enforces the production per-file limit for published results", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    `${validEvalYaml}score_policy: required\nbaseline_policy: required\n`,
  );
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await writePublishedResult(
    path.join(directory, "too-large.json"),
    1_048_577,
  );

  await expectInvalid(root, /published result exceeds 1048576 bytes/);
});

test("enforces the production aggregate limit for published results", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(evalDir, "eval.yaml"),
    `${validEvalYaml}score_policy: required\nbaseline_policy: required\n`,
  );
  const directory = path.join(evalDir, "published-results");
  await mkdir(directory);
  await Promise.all(
    Array.from({ length: 9 }, (_unused, index) =>
      writePublishedResult(
        path.join(directory, `official-${index}.json`),
        932_068,
      ),
    ),
  );

  await expectInvalid(
    root,
    /published-results exceeds 8388608 bytes in total/,
  );
});

test("runs content-security checks through validateRepository", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await Promise.all([
    writeFile(path.join(evalDir, ".env"), "NOT_A_SECRET=fixture\n"),
    symlink("README.md", path.join(evalDir, "linked.md")),
  ]);

  await expectInvalid(
    root,
    /hidden files and directories are not allowed/,
    /symbolic links are not allowed/,
  );
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

test("requires the maintainer to be the effective CODEOWNER", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(path.join(root, ".github", "CODEOWNERS"), "# no eval rules\n\n");

  await expectInvalid(
    root,
    /CODEOWNERS\n\/evals\/sample-eval\/: effective CODEOWNER must be @502399493zjw-lgtm/,
  );
});

test("rejects a different effective CODEOWNER", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "* @different-owner\n",
  );

  await expectInvalid(
    root,
    /\/evals\/sample-eval\/: effective CODEOWNER must be @502399493zjw-lgtm/,
  );
});

test("AUTHORS does not need repository write access through CODEOWNERS", async (t) => {
  const { root } = await makeFixture(t);

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
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

test("allows comments and blank lines around the maintainer rule", async (t) => {
  const { root, evalDir } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "# Repository maintainer\n\n* @502399493zjw-lgtm\n",
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

test("allows unrelated CODEOWNERS patterns before the maintainer catch-all", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "/docs/ @docs-owner\n* @502399493zjw-lgtm\n",
  );

  assert.deepEqual(await validateRepository(root), {
    evalCount: 1,
    evalIds: ["sample-eval"],
  });
});

test("rejects a later rule that overrides the maintainer for eval files", async (t) => {
  const { root } = await makeFixture(t);
  await writeFile(
    path.join(root, ".github", "CODEOWNERS"),
    "* @502399493zjw-lgtm\n*.yaml @different-owner\n",
  );

  await expectInvalid(
    root,
    /evals\/sample-eval\/eval\.yaml: effective CODEOWNER must be @502399493zjw-lgtm/,
  );
});

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
    /CODEOWNERS\n\/evals\/sample-eval\/: effective CODEOWNER must be @502399493zjw-lgtm/,
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
      "* @502399493zjw-lgtm\n",
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
