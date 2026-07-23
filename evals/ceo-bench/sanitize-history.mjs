#!/usr/bin/env node

import {
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";

const FINAL_CASH_SQL = "SELECT COALESCE(SUM(amount), 0) AS final_cash FROM ledger";
const REQUIRED_DAYS = 497;
const HISTORY_MAX_BYTES = 64 * 1024 * 1024;
const HISTORY_MAX_LINES = 100_000;
const HISTORY_MAX_LINE_BYTES = 1024 * 1024;

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new InputError(message);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseArgs(argv) {
  assert(
    argv.length === 3 && argv[1] === "--out",
    "用法：node sanitize-history.mjs <raw-history.jsonl> --out <public-history.jsonl>",
  );
  return { input: resolve(argv[0]), output: resolve(argv[2]) };
}

function readInput(filePath) {
  let metadata;
  try {
    metadata = lstatSync(filePath);
  } catch {
    throw new InputError("原始 history 无法读取");
  }
  assert(metadata.isFile(), "原始 history 必须是普通文件，不能是目录或符号链接");
  assert(metadata.size <= HISTORY_MAX_BYTES, `原始 history 超过 ${HISTORY_MAX_BYTES} bytes 上限`);
  const bytes = readFileSync(filePath);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InputError("原始 history 不是合法 UTF-8");
  }
}

function parseRawHistory(text) {
  const rawLines = text.split(/\r?\n/u);
  if (rawLines.at(-1) === "") {
    rawLines.pop();
  }
  assert(rawLines.length > 0, "原始 history 不能为空");
  assert(rawLines.length <= HISTORY_MAX_LINES, `原始 history 最多 ${HISTORY_MAX_LINES} 行`);

  const observedDays = new Set();
  let maximumDay = 0;
  let lastAdvanceIndex = -1;
  const finalQueryIndexes = [];

  for (const [index, line] of rawLines.entries()) {
    assert(line.trim().length > 0, `原始 history 第 ${index + 1} 行不能为空`);
    assert(
      Buffer.byteLength(line) <= HISTORY_MAX_LINE_BYTES,
      `原始 history 第 ${index + 1} 行过长`,
    );
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      throw new InputError(`原始 history 第 ${index + 1} 行不是合法 JSON`);
    }
    assert(isRecord(record), `原始 history 第 ${index + 1} 行必须是 JSON object`);

    if (record.type === "next_week") {
      assert(
        Number.isSafeInteger(record.day) &&
          record.day >= 1 &&
          record.day <= REQUIRED_DAYS,
        `原始 history 第 ${index + 1} 行的推进日必须在 1-${REQUIRED_DAYS}`,
      );
      observedDays.add(record.day);
      maximumDay = Math.max(maximumDay, record.day);
      lastAdvanceIndex = index;
      continue;
    }

    if (
      record.type === "query" &&
      record.sql === FINAL_CASH_SQL &&
      record.row_count === 1 &&
      record.success === true
    ) {
      finalQueryIndexes.push(index);
    }
  }

  assert(maximumDay > 0, "原始 history 缺少 next_week 推进记录");
  assert(
    finalQueryIndexes.some((index) => index > lastAdvanceIndex),
    "原始 history 缺少运行结束后的规定 final_cash 查询",
  );

  const publicDays = [];
  for (let day = 7; day <= maximumDay; day += 7) {
    publicDays.push(day);
  }
  if (maximumDay % 7 !== 0) {
    publicDays.push(maximumDay);
  }
  for (const day of publicDays) {
    assert(observedDays.has(day), `原始 history 缺少第 ${day} 天的推进边界`);
  }

  return [
    ...publicDays.map((day) => ({ type: "next_week", day })),
    {
      type: "query",
      sql: FINAL_CASH_SQL,
      row_count: 1,
      success: true,
    },
  ];
}

function writeAtomic(inputPath, outputPath, records) {
  const outputParent = realpathSync(dirname(outputPath));
  const canonicalOutput = resolve(outputParent, basename(outputPath));
  const canonicalInput = realpathSync(inputPath);
  assert(canonicalOutput !== canonicalInput, "公开 history 不能覆盖原始 history");

  try {
    const existing = lstatSync(canonicalOutput);
    assert(existing.isFile(), "公开 history 输出位置必须是普通文件");
  } catch (error) {
    if (error instanceof InputError) {
      throw error;
    }
    if (error.code !== "ENOENT") {
      throw new InputError("公开 history 输出位置无法检查");
    }
  }

  const contents = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const temporaryPath = `${canonicalOutput}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
    renameSync(temporaryPath, canonicalOutput);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // Nothing to clean up.
    }
    if (error instanceof InputError) {
      throw error;
    }
    throw new InputError("公开 history 写入失败");
  }
}

try {
  const args = parseArgs(process.argv.slice(2));
  const records = parseRawHistory(readInput(args.input));
  writeAtomic(args.input, args.output, records);
  process.stdout.write(`已生成脱敏 history：${args.output}\n`);
} catch (error) {
  const message = error instanceof InputError ? error.message : "history 脱敏失败";
  process.stderr.write(`错误：${message}\n`);
  process.exitCode = 1;
}
