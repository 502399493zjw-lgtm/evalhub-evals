# 任务与合成示例

`eval.yaml` 中六个唯一 task ID 与来源仓库的六个 benchmark profile 一一对应。每项输入不是一道静态问答，而是一场独立、受预算约束的数据研究运行；期望输出是预先选择检查点在来源官方评测服务中得到的成功试验次数。转换器用固定 `n_tasks × n_attempts` 分母唯一还原 benchmark-native `harbor_score`。

[`example-submission.json`](example-submission.json) 是 custom runner 的完整合成输入，只用于展示结构和本地自测，不是 `evalhub pack` 的默认输入。模型名、run ID、分数、URL 和 SHA-256 都是格式测试数据，不代表任何真实模型成绩，也没有得到 EvalHub 或上游作者核验。真实提交必须另建 JSON，不能修改或冒充这个示例。

审查源码后，在 `evalhub fetch` 下载的 pinned checkout 根目录显式安装锁定依赖，再运行合成测试。转换器不会静默安装依赖；不要使用可能改写锁文件并破坏 checkout 洁净性的 `npm install`：

```bash
npm ci --ignore-scripts
node evals/rsibench-data/pack-to-result.mjs \
  evals/rsibench-data/tasks/example-submission.json \
  --out /tmp/rsibench-data-example-result.json
```

转换器要求六项恰好各出现一次，并按固定 task 顺序输出 `task_results` 和数值宏平均；多项、缺项、重复项、错误协议、超出固定试验总数的成功次数、非整数计数、本机或 IP 地址、临时签名 URL 或非法 SHA-256 都会被拒绝。转换失败时不会留下 `null` 或部分分数结果。

[`rsibench-official-results-2026-07-31.json`](rsibench-official-results-2026-07-31.json) 是官网 Official 矩阵的事实快照，包含四位研究者、六个 benchmark、固定分母、来源页面 SHA-256 与 EvalHub 派生宏平均。它不是 custom runner 的输入，也不表示 EvalHub 独立复跑。`../official-result-to-envelope.mjs` 只接受快照中四个固定 `participant_id`，并在生成 `upstream_author_publication` 结果前重新验证：

1. 快照恰好含四位研究者与六个唯一 benchmark，且每位研究者的底层模型与 harness 独立声明、可重新组成官网展示名；
2. 每个官网两位小数分数与固定分母下的整数成功计数一致；
3. 六项精确百分比的等权平均与快照中的派生总分一致；
4. 输出通过共享结果 schema 和本目录 `eval.yaml` 的上下文校验，且 `score` 必须为数值。
