/**
 * 从平台的模型身份 bootstrap SQL 生成 vendor/evalhub-models/registry.json。
 *
 * 这是平台侧 scripts/vendor-evalhub-schemas.mjs --check 缺失的对端：schema 漂移
 * 平台会拦，模型注册表漂移过去没人拦，于是投稿仓库可以合入一个平台解析不了的
 * participant.model，直到 push 到 main 才在 webhook 里炸开（2026-08-07 事故）。
 *
 * 用法：
 *   node scripts/vendor-evalhub-models.mjs --platform <平台仓库路径>          # 写入快照
 *   node scripts/vendor-evalhub-models.mjs --platform <平台仓库路径> --check  # 只检查漂移
 *
 * 不带 --platform 时 --check 退化为"快照自身完整性检查"（sourceSha256 与内容
 * 是否一致），这样 CI 在拿不到平台仓库时依然能拦住手改快照。
 */

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const defaultOutput = path.join(
  repositoryRoot,
  "vendor/evalhub-models/registry.json",
);
const PLATFORM_SEED = "scripts/ops/bootstrap-model-identity.sql";

function parseArgs(argv) {
  let check = false;
  let platform = null;
  let output = defaultOutput;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--check") {
      check = true;
      continue;
    }
    if (token === "--platform" || token === "--out") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`参数 ${token} 缺少取值`);
      }
      if (token === "--platform") {
        platform = value;
      } else {
        output = path.resolve(value);
      }
      index += 1;
      continue;
    }
    throw new Error(`未知参数 ${token}`);
  }
  return { check, platform, output };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * 只认 bootstrap SQL 里的两类记录：models_meta 行与 model_aliases 行。解析刻意
 * 保守 —— 认不出的 INSERT 直接报错，绝不"尽力猜"，否则快照会静默缺项而检查通过。
 */
export function parseModelSeed(sql) {
  const models = [];
  const aliases = [];
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => /^insert\s+into/iu.test(statement));

  for (const statement of statements) {
    const target = /^insert\s+into\s+([A-Za-z0-9_."]+)/iu.exec(statement)?.[1];
    const table = target?.replaceAll('"', "").split(".").pop();
    // 只取这两张 bootstrap 临时表：它们是注册表的字面数据，models_meta /
    // model_aliases 的插入是 INSERT ... SELECT，没有字面取值。后段
    // bootstrap_expected_history 等表是历史结果回填（按 CEO-Bench 快照指纹绑定
    // "Gemini 3 Flash"），刻意不建全局 alias，因此绝不能收进快照 —— 否则这里会
    // 凭空多出一条平台并不存在的映射，把校验放过。
    if (table !== "bootstrap_models" && table !== "bootstrap_aliases") {
      continue;
    }
    const columnList = /\(([^)]*)\)\s*values/iu.exec(statement)?.[1];
    if (!columnList) {
      throw new Error(`无法解析 ${table} 的列清单：${statement.slice(0, 80)}`);
    }
    const columns = columnList
      .split(",")
      .map((column) => column.trim().replaceAll('"', "").toLowerCase());
    for (const tuple of extractTuples(statement)) {
      if (tuple.length !== columns.length) {
        throw new Error(
          `${table} 的取值个数与列清单不符：${tuple.join(", ").slice(0, 80)}`,
        );
      }
      const row = Object.fromEntries(
        columns.map((column, position) => [column, tuple[position]]),
      );
      if (table === "bootstrap_models") {
        models.push({
          modelId: row.model_id,
          vendor: row.vendor,
          displayName: row.display_name,
          deprecated: /^true$/iu.test(String(row.deprecated ?? "false")),
        });
      } else {
        aliases.push({
          alias: row.alias,
          normalizedAlias: row.normalized_alias ?? row.alias,
          canonicalModelId: row.canonical_model_id,
        });
      }
    }
  }

  if (models.length === 0) {
    throw new Error("平台 bootstrap SQL 里没有解析到任何 bootstrap_models 行");
  }
  return {
    models: models.sort((left, right) =>
      left.modelId.localeCompare(right.modelId),
    ),
    aliases: aliases.sort((left, right) => left.alias.localeCompare(right.alias)),
  };
}

/** 取 VALUES 后的每个括号元组，按单引号字符串切分，'' 视为转义单引号。 */
function extractTuples(statement) {
  const valuesAt = /\bvalues\b/iu.exec(statement);
  if (!valuesAt) return [];
  const body = statement.slice(valuesAt.index + valuesAt[0].length);
  const tuples = [];
  let current = null;
  let field = "";
  let quoted = false;

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (quoted) {
      if (character === "'") {
        if (body[index + 1] === "'") {
          field += "'";
          index += 1;
          continue;
        }
        quoted = false;
        continue;
      }
      field += character;
      continue;
    }
    if (character === "'") {
      quoted = true;
      continue;
    }
    if (character === "(") {
      if (current === null) {
        current = [];
        field = "";
      }
      continue;
    }
    if (current === null) continue;
    if (character === "," || character === ")") {
      const trimmed = field.trim();
      if (trimmed !== "") current.push(stripCast(trimmed));
      field = "";
      if (character === ")") {
        if (current.length > 0) tuples.push(current);
        current = null;
      }
      continue;
    }
    field += character;
  }
  return tuples;
}

function stripCast(value) {
  return value.replace(/::[A-Za-z0-9_ ]+$/u, "").trim();
}

function serialize(registry) {
  return `${JSON.stringify(registry, null, 2)}\n`;
}

export async function vendorEvalhubModels({
  check = false,
  platform = null,
  output = defaultOutput,
} = {}) {
  let existing = null;
  try {
    existing = JSON.parse(await readFile(output, "utf8"));
  } catch (error) {
    // 缺快照在生成模式下正常（这次就是要写出来），在检查模式下必须报错：
    // 静默放过等于把校验交给一份不存在的注册表。其余读取/解析错误一律外抛。
    if (error?.code !== "ENOENT") throw error;
    if (check) throw new Error(`模型注册表快照缺失：${output}`);
  }

  if (platform === null) {
    if (!check) {
      throw new Error("生成快照需要 --platform <平台仓库路径>");
    }
    if (existing === null || typeof existing !== "object") {
      throw new Error(`模型注册表快照不是一个对象：${output}`);
    }
    const { sourceSha256, ...rest } = existing;
    if (!Array.isArray(rest.models)) {
      throw new Error(`模型注册表快照缺少 models 数组：${output}`);
    }
    if (sourceSha256 !== sha256(serialize(rest))) {
      throw new Error(
        `模型注册表快照的 sourceSha256 与内容不符：${output}。请用 --platform 重新生成，不要手改快照。`,
      );
    }
    return { output, checked: true, drifted: false, models: rest.models.length };
  }

  const seedPath = path.join(path.resolve(platform), PLATFORM_SEED);
  const parsed = parseModelSeed(await readFile(seedPath, "utf8"));
  const body = { registrySource: PLATFORM_SEED, ...parsed };
  const registry = { sourceSha256: sha256(serialize(body)), ...body };
  const serialized = serialize(registry);

  if (check) {
    if (existing === null || serialize(existing) !== serialized) {
      throw new Error(
        `模型注册表快照与平台已漂移：${output}。请运行 node scripts/vendor-evalhub-models.mjs --platform <平台仓库路径> 重新生成。`,
      );
    }
    return {
      output,
      checked: true,
      drifted: false,
      models: parsed.models.length,
    };
  }

  await writeFile(output, serialized);
  return { output, checked: false, drifted: false, models: parsed.models.length };
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  try {
    const result = await vendorEvalhubModels(parseArgs(process.argv.slice(2)));
    console.log(
      result.checked
        ? `vendor-evalhub-models: 快照与平台一致（${result.models} 个模型）`
        : `vendor-evalhub-models: 已写入 ${result.output}（${result.models} 个模型）`,
    );
  } catch (error) {
    console.error(`vendor-evalhub-models: ${error.message}`);
    process.exitCode = 1;
  }
}
