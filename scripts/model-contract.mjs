/**
 * 投稿仓库侧的模型身份解析，严格镜像平台 apps/platform/src/services/modelIdentity.ts
 * 的两级索引（exact → snapshot base）。
 *
 * 目的：把"平台解析不了这个 participant.model"从 push-to-main 之后的 webhook
 * 失败，提前到 PR CI 就拦住。2026-08-07 事故里 ceo-bench 的 "Gemini 3 Flash"
 * 就是这样一路合进 main 的 —— 注册表里只有 "Gemini 3 Flash Preview"。
 *
 * 任何一侧算法改动都会被 vendor/evalhub-models/registry.json 的漂移检查逼着同步。
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRegistryPath = path.resolve(
  scriptDir,
  "../vendor/evalhub-models/registry.json",
);

/** 镜像平台 normalizeModelAlias。 */
export function normalizeModelAlias(value) {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_]+/gu, "-")
    .replace(/-{2,}/gu, "-");
}

/** 镜像平台 stripSnapshotDate：无日期后缀或剥空时返回 null。 */
export function stripSnapshotDate(value) {
  const normalized = normalizeModelAlias(value);
  const stripped = normalized.replace(
    /(?:[-.@])20\d{2}(?:[-.]?\d{2}){2}$/u,
    "",
  );
  return stripped === normalized || stripped === "" ? null : stripped;
}

function addCandidate(index, key, candidate) {
  if (key === "") return;
  const existing = index.get(key);
  if (existing === undefined) {
    index.set(key, new Set([candidate]));
    return;
  }
  existing.add(candidate);
}

function uniqueCandidate(values) {
  if (values === undefined || values.size === 0) return { status: "none" };
  if (values.size === 1) return { status: "one", value: [...values][0] };
  return { status: "many", values: [...values].sort() };
}

/**
 * 镜像平台 loadModelIndex：exact 键来自 modelId、displayName、
 * `${vendor}/${displayName}`，以及指向未废弃模型的 alias。废弃模型整体排除。
 */
export function buildModelIndex(registry) {
  const active = registry.models.filter((model) => !model.deprecated);
  const activeIds = new Set(active.map((model) => model.modelId));
  const exact = new Map();

  for (const model of active) {
    addCandidate(exact, normalizeModelAlias(model.modelId), model.modelId);
    addCandidate(exact, normalizeModelAlias(model.displayName), model.modelId);
    addCandidate(
      exact,
      normalizeModelAlias(`${model.vendor}/${model.displayName}`),
      model.modelId,
    );
  }
  for (const alias of registry.aliases) {
    if (!activeIds.has(alias.canonicalModelId)) continue;
    addCandidate(
      exact,
      normalizeModelAlias(alias.normalizedAlias || alias.alias),
      alias.canonicalModelId,
    );
  }

  const snapshotBases = new Map();
  for (const [key, candidates] of exact) {
    const base = stripSnapshotDate(key) ?? key;
    for (const candidate of candidates) {
      addCandidate(snapshotBases, base, candidate);
    }
  }

  return { canonicalIds: [...activeIds].sort(), exact, snapshotBases };
}

/** 镜像平台 resolveModel 的判定顺序与歧义语义。 */
export function resolveModel(rawModel, index) {
  const normalized = normalizeModelAlias(rawModel);
  const exact = uniqueCandidate(index.exact.get(normalized));
  if (exact.status === "one") {
    return { status: "mapped", canonicalModelId: exact.value };
  }
  if (exact.status === "many") {
    return {
      status: "unmapped",
      reason: "ambiguous_model",
      suggestions: exact.values.slice(0, 3),
    };
  }

  const snapshotBase = stripSnapshotDate(normalized);
  if (snapshotBase !== null) {
    const snapshot = uniqueCandidate(index.snapshotBases.get(snapshotBase));
    if (snapshot.status === "one") {
      return { status: "mapped", canonicalModelId: snapshot.value };
    }
    if (snapshot.status === "many") {
      return {
        status: "unmapped",
        reason: "ambiguous_model",
        suggestions: snapshot.values.slice(0, 3),
      };
    }
  }

  return {
    status: "unmapped",
    reason: "unknown_model",
    suggestions: suggestFor(normalized, index.canonicalIds),
  };
}

/**
 * 建议只用来把报错变得可行动，不参与判定，所以按"共享前缀 token 数"排序即可，
 * 不必逐字镜像平台的打分函数。
 */
function suggestFor(normalizedInput, canonicalIds) {
  const base = stripSnapshotDate(normalizedInput) ?? normalizedInput;
  const inputTokens = base.split(/[-/]/u).filter(Boolean);
  return canonicalIds
    .map((canonicalId) => {
      const tokens = normalizeModelAlias(canonicalId)
        .split(/[-/]/u)
        .filter(Boolean);
      const shared = inputTokens.filter((token) => tokens.includes(token)).length;
      return { canonicalId, shared };
    })
    .filter((entry) => entry.shared > 0)
    .sort(
      (left, right) =>
        right.shared - left.shared ||
        left.canonicalId.localeCompare(right.canonicalId),
    )
    .slice(0, 3)
    .map((entry) => entry.canonicalId);
}

export async function loadModelRegistry(registryPath = defaultRegistryPath) {
  try {
    return JSON.parse(await readFile(registryPath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(
        `模型注册表快照缺失：${registryPath}。请运行 node scripts/vendor-evalhub-models.mjs --platform <平台仓库路径>。`,
      );
    }
    throw error;
  }
}

/**
 * 校验一批 participant.model 字符串。返回未映射项，调用方决定如何呈现。
 * entries: Array<{ model, location }>
 */
export function checkModelStrings(entries, index) {
  const failures = [];
  for (const entry of entries) {
    if (typeof entry.model !== "string" || entry.model.trim() === "") {
      failures.push({
        ...entry,
        reason: "participant.model 缺失或为空",
      });
      continue;
    }
    const resolution = resolveModel(entry.model, index);
    if (resolution.status === "mapped") continue;
    const suggestions =
      resolution.suggestions.length > 0
        ? `，建议改用：${resolution.suggestions.join(" / ")}`
        : "";
    failures.push({
      ...entry,
      reason:
        resolution.reason === "ambiguous_model"
          ? `"${entry.model}" 在平台注册表里对应多个模型（歧义）${suggestions}`
          : `"${entry.model}" 不在平台模型注册表中${suggestions}`,
    });
  }
  return failures;
}
