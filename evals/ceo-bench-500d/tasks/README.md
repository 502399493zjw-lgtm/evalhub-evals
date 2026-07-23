# 任务与合成夹具

`example-evidence/` 是一份完整、可直接复制的合成提交目录，用来测试 `pack-to-result.mjs`：

- `example-evidence/submission.json`：参赛模型、provider、harness 与三个公开 artifact 的声明。
- `example-evidence/run-{1,2,3}/`：与 manifest 同级的三次合成证据。
- 每次证据均含 remote、commit、唯一 session 列表、status、final cash 查询与经过白名单脱敏的 history JSONL。

可以从仓库根目录运行：

```bash
node evals/ceo-bench-500d/pack-to-result.mjs \
  evals/ceo-bench-500d/tasks/example-evidence/submission.json \
  --out /tmp/ceo-bench-500d-example-result.json
```

这些数字和 URL 均为测试数据，不是模型实测成绩，也没有通过评测作者验证。真实提交必须另建提交目录，不要修改或冒充这些夹具。
