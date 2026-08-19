# 完整 200 题报告清单

`eval.yaml` 展示固定 GitHub 快照中的 20 个公开任务；完整 200 题只能由上游作者按论文协议运行。
本目录的转换器不运行模型，只校验一份上游作者已审核的完整集报告并封装结果。

## 命令

```text
node evals/vibelifebench/pack-to-result.mjs <submission.json> --out <result.json>
```

输入必须是 UTF-8 JSON 普通文件，最大 1 MiB。转换器拒绝未知字段。顶层结构：

- `manifest_version`: 必须为 `1`；
- `eval_id`: 必须为 `vibelifebench`；
- `protocol_revision`: 必须为 `1`；
- `upstream_commit`: 必须为 `60a042e405377b89b3b00a99a45fb38039f13013`；
- `paper_version`: 必须为 `arXiv:2608.10875v2`；
- `benchmark_scope`: 必须声明 `task_count: 200`、`domain_count: 10`、
  `attempts_per_task: 3`；
- `participant`: EvalHub 模型 ID、harness 和 harness 版本；
- `run_date`: 真实存在的 `YYYY-MM-DD` 日期；
- `author_review`: `upstream_author_reviewed` 只接受 `true`，`evidence_url` 必须为 HTTPS，
  `evidence_sha256` 是审核证据包的 64 位小写十六进制 SHA-256；
- `scores`: 完整集 `avg_at_3`、`max_at_3`、`min_at_3`、`mean_within_task_sigma`，以及固定
  十领域 `domain_avg_at_3` 和固定八组 `check_pass_rates`。

所有分数必须是 0–100 的有限数值。`min_at_3 <= avg_at_3 <= max_at_3`。十领域键固定为
`career`、`exam_preparation`、`finance`、`fitness`、`litigation`、`renovation`、`rental`、
`shopping`、`team_building`、`travel`；检查组键固定为 `per_stage`、`cross_stage`、`final`、
`proactivity`、`propagation_and_recovery`、`persistence_and_bookkeeping`、`safety_and_privacy`、
`authorization_boundary`。

转换器把 `scores.avg_at_3` 原样作为主分数，不从领域舍入值反推，也不补齐缺失值。上游作者
审核是接纳条件；清单里的布尔值只是可机器校验的声明，不能替代证据包本身和人工核查。

## 示例边界

`example-submission.json` 与由它生成的 `sample-result.json` 只展示结构：participant 明确使用
`example/synthetic-agent`，数值是人为选择的示例，证据摘要是可复算的占位文本 SHA-256。
它们不是基线、不是任何真实模型成绩、不是上游作者审核结论，也不会进入榜单。

真正的已发表基线只在 `published-results/official-paper-v2-2026-08-16.json` 中。
