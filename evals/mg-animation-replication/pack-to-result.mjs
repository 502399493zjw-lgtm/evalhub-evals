import { createHash } from "node:crypto";
import { readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EvalDefSchema, ResultFileSchema, validateResultForEval } from "@evalhub/schemas";
import { parse as parseYaml } from "yaml";

const EVAL_ID = "mg-animation-replication";
const TASK_ID = "mg-animation-replication-v1";
const RUNNER_VERSION = "mg-animation-replication/pack-to-result@1.0.0";
const MAX_BYTES = 1024 * 1024;
const SHA = /^[0-9a-f]{64}$/u;
const TEXT = /^[^\u0000-\u001f\u007f-\u009f]{1,255}$/u;
const MODEL = /^[A-Za-z0-9._/:+-]{4,255}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const FILENAME = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,199}\.mp4$/u;
const STATUSES = ["scored", "invalid", "failed", "timeout", "missing"];
const PROTOCOL = Object.freeze({
  prompt_sha256: "17d3870e7fca163d8a7c269968bd9462254244c64aaed670ae7d40f6af8d438f",
  plan_sha256: "f9a2f51da820b7cb4754715145d695d1a137b482e4e29f18a2576e704155bfa1",
  config_sha256: "1facda3b3a305bc8ee5deb6e16312b0a45c2c64805366389515a8db80bd3f5dd",
  brand_spec_sha256: "8fa8bbc2d279a9d8a1f3c742c589e82cbfd8d8b8b181066608336ffb0f6c59da",
  reference_video_sha256: "86cab73954c05b6811e23c6ebefa5c923af585db19c65ac6a9eb5bd51a625ce9",
  logo_sha256: "e3bf841329f81c1f4b269f930299306cbc9a614a030049ba5e9369ad65a02086",
  font_sha256: "b4f59dce22df0f43425262611a786b7f1581fa2667fad5861afbfb249e5a8dba",
  validator_sha256: "227c12a6ba7dee103b52f8c35ca45a7f53cc4c7c441f2fe9414b27d49c708783",
  timeout_seconds: 5400,
});
const TOP_KEYS = ["manifest_version", "eval_id", "protocol_revision", "task_id", "participant", "run_date", "protocol", "result"];
const PARTICIPANT_KEYS = ["model", "harness", "harness_version"];
const RESULT_KEYS = ["status", "original_frames_reused", "media", "rubric", "evidence"];
const MEDIA_KEYS = ["video_exists", "playable", "filename", "filename_ok", "brand_ui_ok", "temp_files_cleaned", "width", "height", "fps", "duration_seconds", "audio_sample_rate_hz", "audio_channels"];
const RUBRIC_LIMITS = Object.freeze({ timeline: 30, composition_visual: 25, motion_transitions: 15, technical_quality: 15, brand_and_filename: 5, tool_loop: 10 });
const EVIDENCE_KEYS = ["run_log_sha256", "media_report_sha256", "frame_reuse_audit_sha256", "blind_review_sha256", "video_sha256"];

class PackError extends Error {}
function fail(message) { throw new PackError(message); }
function object(value, label) { if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} 必须是 JSON 对象`); return value; }
function only(value, keys, label) { for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${label} 含未知字段 ${JSON.stringify(key)}`); }
function string(value, pattern, label) { if (typeof value !== "string" || value !== value.trim() || !pattern.test(value)) fail(`${label} 缺失或格式不合法`); return value; }
function bool(value, label) { if (typeof value !== "boolean") fail(`${label} 必须是布尔值`); return value; }
function integer(value, min, max, label) { if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${label} 必须是 ${min} 到 ${max} 之间的整数`); return value; }
function finite(value, min, max, label) { if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail(`${label} 必须是 ${min} 到 ${max} 之间的有限数值`); return value; }
function nullable(value, validator, label) { return value === null ? null : validator(value, label); }
function sha(value, label) { return string(value, SHA, label); }
function nullableSha(value, label) { return value === null ? null : sha(value, label); }
function realDate(value) {
  string(value, DATE, "run_date"); const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) fail("run_date 必须是真实存在的 YYYY-MM-DD 日期"); return value;
}
function args(argv) {
  if (argv.length !== 3 || argv[1] !== "--out") fail("用法：node evals/mg-animation-replication/pack-to-result.mjs <submission.json> --out <result.json>");
  const input = resolve(argv[0] ?? ""); const output = resolve(argv[2] ?? "");
  if (!argv[2]?.endsWith(".json") || input === output) fail("输出必须是不同于输入的 .json 文件"); return { input, output };
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
  return { model: string(value.model, MODEL, "participant.model"), harness: string(value.harness, TEXT, "participant.harness"), harness_version: string(value.harness_version, TEXT, "participant.harness_version") };
}
function protocol(raw) {
  const value = object(raw, "protocol"); only(value, Object.keys(PROTOCOL), "protocol");
  for (const [key, expected] of Object.entries(PROTOCOL)) if (value[key] !== expected) fail(`protocol.${key} 必须是冻结值 ${expected}`);
}
function media(raw) {
  const value = object(raw, "result.media"); only(value, MEDIA_KEYS, "result.media");
  const out = {};
  for (const key of ["video_exists", "playable", "filename_ok", "brand_ui_ok", "temp_files_cleaned"]) out[key] = bool(value[key], `result.media.${key}`);
  if (!out.video_exists) {
    if (out.playable || out.filename_ok || out.brand_ui_ok) fail("成片不存在时 playable、filename_ok、brand_ui_ok 必须为 false");
    for (const key of ["filename", "width", "height", "fps", "duration_seconds", "audio_sample_rate_hz", "audio_channels"]) if (value[key] !== null) fail(`成片不存在时 result.media.${key} 必须为 null`);
    return { ...out, filename: null, width: null, height: null, fps: null, duration_seconds: null, audio_sample_rate_hz: null, audio_channels: null };
  }
  const filename = string(value.filename, FILENAME, "result.media.filename");
  if (filename.toLowerCase() === "final.mp4") fail("成片不得命名为 final.mp4");
  if (!out.playable) {
    for (const key of ["width", "height", "fps", "duration_seconds", "audio_sample_rate_hz", "audio_channels"]) if (value[key] !== null) fail(`成片不可播放时 result.media.${key} 必须为 null`);
    return { ...out, filename, width: null, height: null, fps: null, duration_seconds: null, audio_sample_rate_hz: null, audio_channels: null };
  }
  return { ...out, filename, width: integer(value.width, 1, 16384, "result.media.width"), height: integer(value.height, 1, 16384, "result.media.height"), fps: finite(value.fps, 0.001, 1000, "result.media.fps"), duration_seconds: finite(value.duration_seconds, 0.001, 86400, "result.media.duration_seconds"), audio_sample_rate_hz: integer(value.audio_sample_rate_hz, 1, 768000, "result.media.audio_sample_rate_hz"), audio_channels: integer(value.audio_channels, 1, 32, "result.media.audio_channels") };
}
function rubric(raw, status) {
  const value = object(raw, "result.rubric"); only(value, Object.keys(RUBRIC_LIMITS), "result.rubric"); const out = {};
  for (const [key, max] of Object.entries(RUBRIC_LIMITS)) out[key] = finite(value[key], 0, max, `result.rubric.${key}`);
  if (status !== "scored" && Object.values(out).some((score) => score !== 0)) fail("非 scored 状态的六项分数必须全部为 0"); return out;
}
function evidence(raw, hasVideo) {
  const value = object(raw, "result.evidence"); only(value, EVIDENCE_KEYS, "result.evidence");
  const out = { run_log_sha256: sha(value.run_log_sha256, "result.evidence.run_log_sha256"), media_report_sha256: sha(value.media_report_sha256, "result.evidence.media_report_sha256"), frame_reuse_audit_sha256: sha(value.frame_reuse_audit_sha256, "result.evidence.frame_reuse_audit_sha256"), blind_review_sha256: sha(value.blind_review_sha256, "result.evidence.blind_review_sha256"), video_sha256: nullableSha(value.video_sha256, "result.evidence.video_sha256") };
  if (hasVideo !== (out.video_sha256 !== null)) fail("video_sha256 是否填写必须与 video_exists 一致");
  const hashes = Object.values(out).filter(Boolean); if (new Set(hashes).size !== hashes.length) fail("每份证据必须使用不同的 SHA-256"); return out;
}
function validate(raw) {
  const top = object(raw, "提交清单"); only(top, TOP_KEYS, "提交清单");
  if (top.manifest_version !== 1 || top.eval_id !== EVAL_ID || top.protocol_revision !== 1 || top.task_id !== TASK_ID) fail("清单身份字段与本评测不一致");
  const who = participant(top.participant); const runDate = realDate(top.run_date); protocol(top.protocol);
  const result = object(top.result, "result"); only(result, RESULT_KEYS, "result");
  if (!STATUSES.includes(result.status)) fail(`result.status 必须是 ${STATUSES.join(" / ")}`);
  const reused = bool(result.original_frames_reused, "result.original_frames_reused");
  if ((result.status === "invalid") !== reused) fail("只有 invalid 状态能且必须把 original_frames_reused 设为 true");
  const mediaData = media(result.media); const rubricData = rubric(result.rubric, result.status); const evidenceData = evidence(result.evidence, mediaData.video_exists);
  if (result.status === "scored" && (!mediaData.video_exists || !mediaData.playable || !mediaData.filename_ok)) fail("scored 状态必须有可播放且文件名合规的成片");
  const score = result.status === "scored" ? Object.values(rubricData).reduce((sum, value) => sum + value, 0) : 0;
  return { who, runDate, status: result.status, reused, media: mediaData, rubric: rubricData, evidence: evidenceData, score };
}
function envelope(run, digest) {
  const r = run.rubric; const m = run.media; const evidenceCount = Object.values(run.evidence).filter(Boolean).length;
  return { eval_id: EVAL_ID, submission: { kind: "run", runner_version: RUNNER_VERSION, run_date: run.runDate }, results: [{
    participant: run.who, score: run.score, raw_metric: { label: "六项复刻量表总分", value: `${run.score} 分` },
    detail: `Derived: 主分 = 时间线 ${r.timeline} + 构图视觉 ${r.composition_visual} + 运动转场 ${r.motion_transitions} + 技术质量 ${r.technical_quality} + 品牌交付 ${r.brand_and_filename} + 工具闭环 ${r.tool_loop} = ${run.score}。状态=${run.status}；原片画面复用=${run.reused ? "是" : "否"}；清单 sha256=${digest}。转换成功只证明结构与求和合规，作者仍须核对原片、成片、日志和盲审证据。`,
    task_results: [{ task_id: TASK_ID, score: run.score, raw: `${run.status} · frame-reuse ${run.reused ? "yes" : "no"} · ${m.filename ?? "no-video"}` }],
    supplementary_views: [
      { type: "metric_table", id: "run-rubric-breakdown", label: "六项得分", title: "本次运行的 MG 复刻量表", columns: ["分项", "得分", "满分"], rows: [
        { cells: ["镜头与时间线复刻", r.timeline, 30] }, { cells: ["构图与视觉复刻", r.composition_visual, 25] }, { cells: ["运动与转场", r.motion_transitions, 15] }, { cells: ["成片技术质量", r.technical_quality, 15] }, { cells: ["Web4 品牌 UI 与文件命名", r.brand_and_filename, 5] }, { cells: ["工具调用闭环", r.tool_loop, 10] },
      ], note: "Derived: 六项来自作者认可的冻结盲审表，直接相加形成主分；invalid、failed、timeout、missing 的六项均为 0。" },
      { type: "metric_table", id: "run-media-checks", label: "媒体检查", title: "本次运行的成片与失效检查", columns: ["检查项", "值"], rows: [
        { cells: ["状态", run.status] }, { cells: ["原片画面复用", run.reused ? "是" : "否"] }, { cells: ["成片存在", m.video_exists ? "是" : "否"] }, { cells: ["可播放", m.playable ? "是" : "否"] },
        { cells: ["文件名", m.filename] }, { cells: ["品牌采样通过", m.brand_ui_ok ? "是" : "否"] }, { cells: ["临时文件已清理", m.temp_files_cleaned ? "是" : "否"] },
        { cells: ["分辨率", m.playable ? `${m.width}×${m.height}` : null] }, { cells: ["帧率", m.fps] }, { cells: ["时长（秒）", m.duration_seconds] }, { cells: ["音频采样率（Hz）", m.audio_sample_rate_hz] }, { cells: ["声道", m.audio_channels] },
      ], note: "媒体字段来自受控运行的 ffprobe 与品牌检查报告，仅用于解释结果；帧复用失效结论还需日志、抽帧与人工复核。" },
      { type: "metric_table", id: "run-evidence-summary", label: "证据摘要", title: "本次运行的证据摘要状态", columns: ["项目", "值"], rows: [
        { cells: ["非空 SHA-256 数量", evidenceCount] }, { cells: ["运行日志", "已绑定"] }, { cells: ["媒体报告", "已绑定"] }, { cells: ["帧复用审计", "已绑定"] }, { cells: ["盲审表", "已绑定"] }, { cells: ["成片", run.evidence.video_sha256 ? "已绑定" : "无"] }, { cells: ["提交清单 SHA-256", digest] },
      ], note: "公开结果只显示摘要覆盖情况，不上传参考片、品牌资产或成片；作者认可前须核对原件。" },
    ],
  }] };
}
function evalDefinition() { const path = resolve(dirname(fileURLToPath(import.meta.url)), "eval.yaml"); return EvalDefSchema.parse(parseYaml(readFileSync(path, "utf8"))); }
function write(output, value) { const temp = resolve(dirname(output), `.${basename(output)}.tmp-${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16)}`); writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 }); renameSync(temp, output); }

try {
  const { input, output } = args(process.argv.slice(2)); const source = read(input); const run = validate(source.value);
  const result = ResultFileSchema.parse(envelope(run, source.digest)); const contextual = validateResultForEval(evalDefinition(), result);
  if (!contextual.success) fail(`结果不符合评测定义：${contextual.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  write(output, result); console.log(`已写出 ${output}`);
} catch (error) { console.error(error instanceof PackError ? error.message : `转换失败：${error.message}`); process.exitCode = 1; }
