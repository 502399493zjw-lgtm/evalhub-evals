import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildModelIndex,
  checkModelStrings,
  loadModelRegistry,
  normalizeModelAlias,
  resolveModel,
  stripSnapshotDate,
} from "../model-contract.mjs";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

function registry({ models = [], aliases = [] } = {}) {
  return { models, aliases };
}

function model(modelId, overrides = {}) {
  const [vendor, name] = modelId.split("/");
  return {
    modelId,
    vendor,
    displayName: name,
    deprecated: false,
    ...overrides,
  };
}

test("normalizeModelAlias 镜像平台的折叠规则", () => {
  assert.equal(normalizeModelAlias("  GPT_5.5  "), "gpt-5.5");
  assert.equal(normalizeModelAlias("Gemini 3   Flash"), "gemini-3-flash");
  assert.equal(normalizeModelAlias("Claude__Opus  4.8"), "claude-opus-4.8");
});

test("stripSnapshotDate 只在真的剥掉日期后缀时返回值", () => {
  assert.equal(stripSnapshotDate("claude-haiku-4-5-20251001"), "claude-haiku-4-5");
  assert.equal(stripSnapshotDate("gpt-5.5.2026-01-31"), "gpt-5.5");
  assert.equal(stripSnapshotDate("gemini-3-flash"), null);
  assert.equal(stripSnapshotDate("20260131"), null);
});

test("modelId、displayName、vendor/displayName 三种写法都能解析", () => {
  const index = buildModelIndex(registry({ models: [model("google/gemini-3-flash-preview")] }));
  for (const spelling of [
    "google/gemini-3-flash-preview",
    "Gemini 3 Flash Preview",
    "google/Gemini 3 Flash Preview",
  ]) {
    assert.deepEqual(resolveModel(spelling, index), {
      status: "mapped",
      canonicalModelId: "google/gemini-3-flash-preview",
    });
  }
});

test("废弃模型及指向废弃模型的 alias 都不参与解析", () => {
  const index = buildModelIndex(
    registry({
      models: [model("vendor-a/retired", { deprecated: true })],
      aliases: [
        {
          alias: "Retired",
          normalizedAlias: "retired",
          canonicalModelId: "vendor-a/retired",
        },
      ],
    }),
  );
  assert.equal(resolveModel("vendor-a/retired", index).status, "unmapped");
  assert.equal(resolveModel("Retired", index).status, "unmapped");
});

test("同一写法对应多个模型时报歧义而不是随便挑一个", () => {
  const index = buildModelIndex(
    registry({
      models: [
        model("vendor-a/shared", { displayName: "Shared" }),
        model("vendor-b/other", { displayName: "Shared" }),
      ],
    }),
  );
  const resolution = resolveModel("Shared", index);
  assert.equal(resolution.status, "unmapped");
  assert.equal(resolution.reason, "ambiguous_model");
  assert.deepEqual(resolution.suggestions, ["vendor-a/shared", "vendor-b/other"]);
});

test("带日期后缀的写法回落到 snapshot base", () => {
  const index = buildModelIndex(
    registry({ models: [model("anthropic/claude-haiku-4-5")] }),
  );
  assert.deepEqual(resolveModel("claude-haiku-4-5-20251001", index), {
    status: "mapped",
    canonicalModelId: "anthropic/claude-haiku-4-5",
  });
});

test("checkModelStrings 报出字段位置，缺失与空串都算失败", () => {
  const index = buildModelIndex(registry({ models: [model("vendor-a/known")] }));
  const failures = checkModelStrings(
    [
      { model: "vendor-a/known", location: "results[0].participant.model" },
      { model: "   ", location: "results[1].participant.model" },
      { model: undefined, location: "results[2].participant.model" },
    ],
    index,
  );
  assert.equal(failures.length, 2);
  assert.deepEqual(
    failures.map((failure) => failure.location),
    ["results[1].participant.model", "results[2].participant.model"],
  );
  for (const failure of failures) {
    assert.match(failure.reason, /participant\.model 缺失或为空/u);
  }
});

test("仓库里所有 published-results 的 participant.model 都能被平台解析", async () => {
  const index = buildModelIndex(await loadModelRegistry());
  const evalsDir = path.join(repositoryRoot, "evals");
  const entries = [];
  // evals/ 下允许存在非目录条目（例如说明文件），只有目录才是 slug；
  // validate.mjs 与 runner-sandbox.mjs 同样只认目录。
  const evalSlugs = (await readdir(evalsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const slug of evalSlugs) {
    const resultsDir = path.join(evalsDir, slug, "published-results");
    let fileNames;
    try {
      fileNames = await readdir(resultsDir);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    for (const fileName of fileNames.filter((name) => name.endsWith(".json"))) {
      const filePath = path.join(resultsDir, fileName);
      const document = JSON.parse(await readFile(filePath, "utf8"));
      for (const [position, result] of (document.results ?? []).entries()) {
        entries.push({
          model: result?.participant?.model,
          location: `evals/${slug}/published-results/${fileName} results[${position}]`,
        });
      }
    }
  }
  // 仓库里有 eval 时这条守卫必须成立：扫不到任何记录说明扫描路径坏了。
  // 仓库里没有 eval 时没有可扫的对象，守卫本身就无从成立。
  if (evalSlugs.length > 0) {
    assert.ok(entries.length > 0, "没有扫到任何 published-results 记录");
  }
  assert.deepEqual(
    checkModelStrings(entries, index).map(
      (failure) => `${failure.location}: ${failure.reason}`,
    ),
    [],
  );
});

test("2026-08-07 事故的写法在快照上仍然是 unmapped，且建议指向 preview", async () => {
  const index = buildModelIndex(await loadModelRegistry());
  const resolution = resolveModel("Gemini 3 Flash", index);
  assert.equal(resolution.status, "unmapped");
  assert.equal(resolution.reason, "unknown_model");
  assert.ok(
    resolution.suggestions.includes("google/gemini-3-flash-preview"),
    `建议里没有 preview 身份：${resolution.suggestions.join(", ")}`,
  );
  assert.deepEqual(resolveModel("Gemini 3 Flash Preview", index), {
    status: "mapped",
    canonicalModelId: "google/gemini-3-flash-preview",
  });
});
