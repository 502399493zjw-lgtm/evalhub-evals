// ReplyBench 提交清单 -> EvalHub 结果信封(确定性转换,无网络、无密钥)
// 输入: 提交清单 JSON —— { participant: {model, harness?}, summary: <上游 node aggregate.mjs 产出的 report/summary.json> }
// 用法: node evals/replybench/pack-to-result.mjs <submission.json> --out <output.json>
import { readFileSync, writeFileSync } from "node:fs";

const [, , inPath, outFlag, outPath] = process.argv;
if (!inPath || outFlag !== "--out" || !outPath) { console.error("用法: node pack-to-result.mjs <submission.json> --out <output.json>"); process.exit(1); }
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };

const sub = JSON.parse(readFileSync(inPath, "utf8"));
if (!sub.participant?.model || typeof sub.participant.model !== "string") die("缺 participant.model");
const S = sub.summary;
if (!S || S.partial !== false) die("summary 缺失或为 PARTIAL(cohort 不完整,拒绝转换)");
if (S.cohort?.cases !== 17 || S.cohort?.runs_per_case !== 4) die(`cohort 必须为 17 题 × 4 采样,得到 ${S.cohort?.cases} × ${S.cohort?.runs_per_case}`);
if (!Array.isArray(S.models) || !S.models.length) die("summary.models 为空");

const results = S.models.map((m) => {
  if (!(m.macro >= 0 && m.macro <= 1)) die(`${m.name}: macro 越界`);
  if (m.sendableN !== 68) die(`${m.name}: 样本数 ${m.sendableN} ≠ 68(17×4)`);
  return {
    participant: { model: sub.participant.model, ...(sub.participant.harness ? { harness: sub.participant.harness } : {}) },
    score: Math.round(m.macro * 1000) / 10,
    detail: `可发送 ${m.sendableK}/${m.sendableN}(宏平均 ${(m.macro * 100).toFixed(1)}%),pass⁴ ${Math.round(m.passK * 17)}/17,hard-risk 不可发送 ${m.hard?.failedRuns ?? "?"}/${m.hard?.runTotal ?? 36} case-run。strict 双裁判 AND 口径(分歧按不通过计);由 pack-to-result.mjs 从上游 aggregate 产物确定性转换,分母与口径内置、不接受提交方覆盖。`,
  };
});
if (results.length !== 1) die("一份提交清单只允许一个 participant 的一组结果");

writeFileSync(outPath, JSON.stringify({
  eval_id: "replybench",
  submission: { kind: "run", runner_version: "replybench/pack-to-result@1.0.0", run_date: new Date().toISOString().slice(0, 10) },
  results,
}, null, 2));
console.log(`✓ 已写出 ${outPath}`);
