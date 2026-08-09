import { createHash } from "node:crypto";
import { readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EvalDefSchema, ResultFileSchema, validateResultForEval } from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const EVAL_ID = "chibi-3d-print-bench";
const TASK_ID = "chibi-figure-a2-v2-20260803";
const RUNNER_VERSION = "chibi-3d-print-bench/pack-to-result@1.0.0";
const PROTOCOL_REVISION = 1;
const MAX_BYTES = 1024 * 1024;
const SHA = /^[0-9a-f]{64}$/u;
const TEXT = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;
const MODEL = /^[A-Za-z0-9._/:+-]{4,255}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STATUS = ["scored", "failed", "timeout", "missing"];
const EXPECTED_PROTOCOL = Object.freeze({
  prompt_sha256: "69c3fecf345bf5ce8be394624e3fcec2c5523f2ae8352607c56cf2015557af7d",
  reference_image_sha256: "6d89ce11b40c68c3c2c19cfd3e394bb09f6cad984b184b475c45afbc1f13eb64",
  print_contract_sha256: "953ca660c7dc89ea2c381320af0f5daf4511c60eea08eeb1079e8e8a71dd6e5f",
  a2l_process_sha256: "13eaa646495259a974c7924921a7e3e543cddcdef9eb519a30ded8a412875814",
  scorer_sha256: "e8711518e800763f126420bfbabf636b7f7e8bdd3e23e41f726e6f23a3fa4b77",
  pi_version: "0.82.0",
  timeout_seconds: 5400,
});
const TOP_KEYS = ["manifest_version", "eval_id", "protocol_revision", "task_id", "participant", "run_date", "protocol", "result"];
const PARTICIPANT_KEYS = ["model", "harness", "harness_version"];
const RESULT_KEYS = ["status", "artifacts", "mesh", "slicing", "manual", "evidence"];
const ARTIFACT_KEYS = ["stl_exists", "preview_ok", "builder_exists", "readme_exists"];
const MESH_KEYS = ["parsed", "triangle_count", "watertight", "component_count", "dimensions_mm", "stable_bottom"];
const SLICE_KEYS = ["succeeded", "estimated_seconds", "warning_count"];
const MANUAL_KEYS = ["likeness", "sculpt_coherence", "preview_clarity"];
const EVIDENCE_KEYS = ["run_log_sha256", "automatic_report_sha256", "blind_review_sha256", "stl_sha256", "preview_sha256", "builder_sha256", "readme_sha256"];

class PackError extends Error {}
function fail(message) { throw new PackError(message); }
function object(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} 必须是 JSON 对象`);
  return value;
}
function only(value, keys, label) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${label} 含未知字段 ${JSON.stringify(key)}`);
}
function string(value, pattern, label) {
  if (typeof value !== "string" || value !== value.trim() || !pattern.test(value)) fail(`${label} 缺失或格式不合法`);
  return value;
}
function bool(value, label) { if (typeof value !== "boolean") fail(`${label} 必须是布尔值`); return value; }
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${label} 必须是 ${min} 到 ${max} 之间的整数`);
  return value;
}
function finite(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(`${label} 必须是 ${min} 到 ${max} 之间的有限数值`);
  return value;
}
function nullable(value, validator, label) { return value === null ? null : validator(value, label); }
function sha(value, label) { return string(value, SHA, label); }
function nullableSha(value, label) { return value === null ? null : sha(value, label); }
function realDate(value) {
  string(value, DATE, "run_date");
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) fail("run_date 必须是真实存在的 YYYY-MM-DD 日期");
  return value;
}
function args(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") fail("用法：node evals/chibi-3d-print-bench/pack-to-result.mjs <submission.json> --out <result.json>");
  const input = resolve(argv[0] ?? "");
  const output = resolve(argv[2] ?? "");
  if (!argv[2]?.endsWith(".json") || input === output) fail("输出必须是不同于输入的 .json 文件");
  return { input, output };
}
function read(input) {
  let stats; try { stats = statSync(input); } catch (error) { fail(`无法读取清单：${error.message}`); }
  if (!stats.isFile() || stats.size > MAX_BYTES) fail(`清单必须是小于等于 ${MAX_BYTES} 字节的普通文件`);
  const source = readFileSync(input, "utf8");
  try { return { value: JSON.parse(source), digest: createHash("sha256").update(source).digest("hex") }; }
  catch (error) { fail(`清单不是合法 JSON：${error.message}`); }
}
function participant(raw) {
  const value = object(raw, "participant"); only(value, PARTICIPANT_KEYS, "participant");
  return {
    model: string(value.model, MODEL, "participant.model"),
    harness: string(value.harness, TEXT, "participant.harness"),
    harness_version: string(value.harness_version, TEXT, "participant.harness_version"),
  };
}
function protocol(raw) {
  const value = object(raw, "protocol"); only(value, Object.keys(EXPECTED_PROTOCOL), "protocol");
  for (const [key, expected] of Object.entries(EXPECTED_PROTOCOL)) if (value[key] !== expected) fail(`protocol.${key} 必须是冻结值 ${expected}`);
  return value;
}
function evidence(raw, status, artifacts) {
  const value = object(raw, "result.evidence"); only(value, EVIDENCE_KEYS, "result.evidence");
  const out = {
    run_log_sha256: sha(value.run_log_sha256, "result.evidence.run_log_sha256"),
    automatic_report_sha256: sha(value.automatic_report_sha256, "result.evidence.automatic_report_sha256"),
    blind_review_sha256: nullableSha(value.blind_review_sha256, "result.evidence.blind_review_sha256"),
    stl_sha256: nullableSha(value.stl_sha256, "result.evidence.stl_sha256"),
    preview_sha256: nullableSha(value.preview_sha256, "result.evidence.preview_sha256"),
    builder_sha256: nullableSha(value.builder_sha256, "result.evidence.builder_sha256"),
    readme_sha256: nullableSha(value.readme_sha256, "result.evidence.readme_sha256"),
  };
  if ((status === "scored") !== (out.blind_review_sha256 !== null)) fail("blind_review_sha256 仅在 scored 状态必填，其他状态必须为 null");
  for (const [flag, hash] of [["stl_exists", "stl_sha256"], ["preview_ok", "preview_sha256"], ["builder_exists", "builder_sha256"], ["readme_exists", "readme_sha256"]]) {
    if (artifacts[flag] !== (out[hash] !== null)) fail(`${hash} 是否填写必须与 ${flag} 一致`);
  }
  const hashes = Object.values(out).filter(Boolean);
  if (new Set(hashes).size !== hashes.length) fail("每份证据必须使用不同的 SHA-256");
  return out;
}
function validate(raw) {
  const top = object(raw, "提交清单"); only(top, TOP_KEYS, "提交清单");
  if (top.manifest_version !== 1 || top.eval_id !== EVAL_ID || top.protocol_revision !== PROTOCOL_REVISION || top.task_id !== TASK_ID) fail("清单身份字段与本评测不一致");
  const who = participant(top.participant); const runDate = realDate(top.run_date); protocol(top.protocol);
  const result = object(top.result, "result"); only(result, RESULT_KEYS, "result");
  if (!STATUS.includes(result.status)) fail(`result.status 必须是 ${STATUS.join(" / ")}`);
  const artifacts = object(result.artifacts, "result.artifacts"); only(artifacts, ARTIFACT_KEYS, "result.artifacts");
  for (const key of ARTIFACT_KEYS) bool(artifacts[key], `result.artifacts.${key}`);
  const mesh = object(result.mesh, "result.mesh"); only(mesh, MESH_KEYS, "result.mesh"); bool(mesh.parsed, "result.mesh.parsed");
  let meshData;
  if (!mesh.parsed) {
    for (const key of MESH_KEYS.filter((key) => key !== "parsed")) if (mesh[key] !== null) fail(`result.mesh.${key} 在 parsed=false 时必须为 null`);
    meshData = { parsed: false, triangle_count: null, watertight: null, component_count: null, dimensions_mm: null, stable_bottom: null };
  } else {
    const dims = object(mesh.dimensions_mm, "result.mesh.dimensions_mm"); only(dims, ["x", "y", "z"], "result.mesh.dimensions_mm");
    meshData = { parsed: true, triangle_count: integer(mesh.triangle_count, 0, 100000000, "result.mesh.triangle_count"), watertight: bool(mesh.watertight, "result.mesh.watertight"), component_count: integer(mesh.component_count, 0, 1000000, "result.mesh.component_count"), dimensions_mm: { x: finite(dims.x, 0, 10000, "dimensions_mm.x"), y: finite(dims.y, 0, 10000, "dimensions_mm.y"), z: finite(dims.z, 0, 10000, "dimensions_mm.z") }, stable_bottom: bool(mesh.stable_bottom, "result.mesh.stable_bottom") };
  }
  const slicing = object(result.slicing, "result.slicing"); only(slicing, SLICE_KEYS, "result.slicing"); bool(slicing.succeeded, "result.slicing.succeeded");
  const sliceData = slicing.succeeded ? { succeeded: true, estimated_seconds: integer(slicing.estimated_seconds, 0, 604800, "result.slicing.estimated_seconds"), warning_count: integer(slicing.warning_count, 0, 1000000, "result.slicing.warning_count") } : { succeeded: false, estimated_seconds: null, warning_count: null };
  if (!slicing.succeeded && (slicing.estimated_seconds !== null || slicing.warning_count !== null)) fail("切片失败时 estimated_seconds 与 warning_count 必须为 null");
  const manual = object(result.manual, "result.manual"); only(manual, MANUAL_KEYS, "result.manual");
  const manualData = { likeness: finite(manual.likeness, 0, 25, "result.manual.likeness"), sculpt_coherence: finite(manual.sculpt_coherence, 0, 10, "result.manual.sculpt_coherence"), preview_clarity: finite(manual.preview_clarity, 0, 5, "result.manual.preview_clarity") };
  if (result.status !== "scored" && Object.values(manualData).some((value) => value !== 0)) fail("非 scored 状态的人工分必须全部为 0");
  const evidenceData = evidence(result.evidence, result.status, artifacts);
  return { who, runDate, status: result.status, artifacts, mesh: meshData, slicing: sliceData, manual: manualData, evidence: evidenceData };
}
function calculate(run) {
  const a = run.artifacts; const m = run.mesh; const s = run.slicing;
  const sizeOk = m.parsed && m.dimensions_mm.x <= 50 && m.dimensions_mm.y <= 50 && m.dimensions_mm.z >= 40 && m.dimensions_mm.z <= 65;
  const artifacts = Number(a.stl_exists) * 3 + Number(a.preview_ok) * 3 + Number(a.builder_exists) * 2 + Number(a.readme_exists) * 2;
  const mesh = Number(m.parsed) * 3 + Number(m.parsed && m.triangle_count >= 100) * 2 + Number(m.parsed && m.watertight) * 8 + Number(m.parsed && m.component_count === 1) * 4 + Number(sizeOk) * 5 + Number(m.parsed && m.stable_bottom) * 3;
  const slicing = Number(s.succeeded) * 10 + Number(s.succeeded && s.estimated_seconds <= 3600) * 7 + Number(s.succeeded && s.estimated_seconds <= 1800) * 5 + Number(s.succeeded && s.warning_count === 0) * 3;
  const manual = run.manual.likeness + run.manual.sculpt_coherence + run.manual.preview_clarity;
  return { artifacts, mesh, slicing, auto: artifacts + mesh + slicing, manual, score: artifacts + mesh + slicing + manual, sizeOk };
}
function envelope(run, totals, digest) {
  const evidenceCount = Object.values(run.evidence).filter(Boolean).length;
  return {
    eval_id: EVAL_ID,
    submission: { kind: "run", runner_version: RUNNER_VERSION, run_date: run.runDate },
    results: [{
      participant: run.who,
      score: totals.score,
      raw_metric: { label: "自动检查与盲审总分", value: `${totals.score} 分` },
      detail: `Derived: 主分 = 自动交付物 ${totals.artifacts} + 自动网格 ${totals.mesh} + 自动切片 ${totals.slicing} + 人工盲审 ${totals.manual} = ${totals.score}。状态=${run.status}；清单 sha256=${digest}。转换成功只证明结构与公式合规，作者仍须核对原始照片、产物和盲审表。`,
      task_results: [{ task_id: TASK_ID, score: totals.score, raw: `${run.status} · auto ${totals.auto}/60 · blind ${totals.manual}/40` }],
      supplementary_views: [
        { type: "metric_table", id: "run-score-breakdown", label: "分项得分", title: "本次运行的固定分项得分", columns: ["分项", "得分", "满分"], rows: [
          { cells: ["交付物", totals.artifacts, 10] }, { cells: ["网格", totals.mesh, 25] }, { cells: ["统一切片", totals.slicing, 25] },
          { cells: ["人物相似度", run.manual.likeness, 25] }, { cells: ["雕塑一致性", run.manual.sculpt_coherence, 10] }, { cells: ["预览清晰度", run.manual.preview_clarity, 5] },
        ], note: "Derived: 前三项由转换器从原始检查字段按冻结公式重算；后三项来自作者认可的盲审表。六项之和等于主分。" },
        { type: "metric_table", id: "run-engineering-checks", label: "工程检查", title: "本次运行的网格与切片检查", columns: ["检查项", "结果"], rows: [
          { cells: ["状态", run.status] }, { cells: ["STL 存在", run.artifacts.stl_exists ? "是" : "否"] }, { cells: ["预览合格", run.artifacts.preview_ok ? "是" : "否"] },
          { cells: ["网格可解析", run.mesh.parsed ? "是" : "否"] }, { cells: ["三角面", run.mesh.triangle_count] }, { cells: ["水密", run.mesh.watertight === null ? null : run.mesh.watertight ? "是" : "否"] },
          { cells: ["连通分量", run.mesh.component_count] }, { cells: ["尺寸合规", totals.sizeOk ? "是" : "否"] }, { cells: ["稳定底面", run.mesh.stable_bottom === null ? null : run.mesh.stable_bottom ? "是" : "否"] },
          { cells: ["切片成功", run.slicing.succeeded ? "是" : "否"] }, { cells: ["估计秒数", run.slicing.estimated_seconds] }, { cells: ["切片警告数", run.slicing.warning_count] },
        ], note: "这些是生成主分所用的原始工程检查；转换器不读取或展示人物照片、STL 和预览二进制。" },
        { type: "metric_table", id: "run-evidence-summary", label: "证据摘要", title: "本次运行的证据摘要状态", columns: ["项目", "值"], rows: [
          { cells: ["非空 SHA-256 数量", evidenceCount] }, { cells: ["运行日志", "已绑定"] }, { cells: ["自动报告", "已绑定"] },
          { cells: ["盲审表", run.evidence.blind_review_sha256 ? "已绑定" : "无"] }, { cells: ["提交清单 SHA-256", digest] },
        ], note: "仅显示摘要覆盖情况，不公开人物素材和二进制产物。作者认可前仍须核对原件。" },
      ],
    }],
  };
}
function evalDefinition() {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), "eval.yaml");
  return EvalDefSchema.parse(parseYaml(readFileSync(path, "utf8")));
}
function write(output, value) {
  const temp = resolve(dirname(output), `.${basename(output)}.tmp-${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16)}`);
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temp, output);
}
try {
  const { input, output } = args(process.argv.slice(2));
  const source = read(input); const run = validate(source.value); const totals = calculate(run);
  const result = ResultFileSchema.parse(envelope(run, totals, source.digest));
  const contextual = validateResultForEval(evalDefinition(), result);
  if (!contextual.success) fail(`结果不符合评测定义：${contextual.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  write(output, result);
  console.log(`已写出 ${output}`);
} catch (error) {
  console.error(error instanceof PackError ? error.message : `转换失败：${error.message}`);
  process.exitCode = 1;
}
