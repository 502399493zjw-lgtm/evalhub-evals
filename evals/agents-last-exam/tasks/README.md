# ALE 全量结果清单

真实运行仍按上游 ALE 文档和固定提交执行。本目录只接收由 `pack-to-result.mjs` 消费的结果清单，绝不在 EvalHub 中运行 ALE。

## 顶层格式

```json
{
  "manifest_version": 1,
  "eval_id": "agents-last-exam",
  "protocol_revision": 1,
  "upstream_commit": "75a3f866535946b67f9a57e4f158eb30ad50be8a",
  "participant": {
    "model": "provider/model-id",
    "harness": "agent-harness",
    "harness_version": "version-or-commit"
  },
  "run_date": "YYYY-MM-DD",
  "task_results": []
}
```

顶层和嵌套对象拒绝未知字段。`task_results` 必须恰有 152 项，且其 `task_id` 与固定提交的 `selected_tasks/full/overall.txt` 一一对应；缺项、重复项或额外项都会被拒绝。每项格式如下：

```json
{
  "task_id": "agriculture_env/crop_rotation_d02",
  "score": 0.75,
  "run_id": "2026-08-19T090000Z-crop_rotation_d02",
  "run_sha256": "run.json 原始字节的 64 位小写 SHA-256",
  "eval_result_sha256": "eval_result.json 原始字节的 64 位小写 SHA-256"
}
```

`score` 必须是 ALE 最终 `eval_result.json.score` 中的有限 JSON number，范围 `[0, 1]`。失败、缺失或非数值的评测结果在生成清单前应明确记录为 `0`。转换器以 152 为固定分母，输出 `sum(score) / 152 × 100`；它不会读取文件系统中的结果文件或重新判分。

`participant.harness` 与 `participant.harness_version` 要么同时出现、要么同时省略。应使用实际运行的 agent harness 与其真实版本/提交，不应填写推测配置、日期或链接。

[`example-submission.json`](example-submission.json) 是字段级示例，因不包含 152 个真实任务和证据摘要而故意不能通过转换器；它不能作为跑分、基线或提交凭据。
