# 任务与合成示例

`eval.yaml` 中六个唯一 task ID 与来源仓库的六个 benchmark profile 一一对应。每项输入不是一道静态问答，而是一场独立、受预算约束的数据研究运行；期望输出是预先选择检查点在来源官方评测服务中得到的成功试验次数。转换器用固定 `n_tasks × n_attempts` 分母唯一还原 benchmark-native `harbor_score`。

[`example-submission.json`](example-submission.json) 是 custom runner 的完整合成输入。模型名、run ID、分数、URL 和 SHA-256 都是格式测试数据，不代表任何真实模型成绩，也没有得到 EvalHub 或上游作者核验。真实提交必须另建 JSON，不能修改或冒充这个示例。

从 evals 仓库根目录运行合成测试：

```bash
node evals/rsibench-data/pack-to-result.mjs \
  evals/rsibench-data/tasks/example-submission.json \
  --out /tmp/rsibench-data-example-result.json
```

转换器要求六项恰好各出现一次，并按固定 task 顺序输出 `task_results`；多项、缺项、重复项、错误协议、超出固定试验总数的成功次数、非整数计数、本机或 IP 地址、临时签名 URL 或非法 SHA-256 都会被拒绝。
