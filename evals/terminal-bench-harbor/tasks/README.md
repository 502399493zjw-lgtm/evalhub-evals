# 任务与合成示例

`eval.yaml` 中唯一的 task ID `terminal-bench-2-1-full` 对应一次覆盖 `terminal-bench@2.1` 全部任务的完整 Harbor 运行。输入不是一道静态问答，而是一次容器化终端环境中的自主执行；期望输出是该次运行由任务自带校验脚本判定的已解决任务数与总任务数。转换器用整数计数唯一还原通过率，并对三次运行取算术平均。

[`example-submission.json`](example-submission.json) 是 custom runner 的完整合成输入，只用于展示结构和本地自测，**不是 `evalhub pack` 的默认输入**。其中的模型名、run ID、计数、URL 和 SHA-256 都是格式测试数据，不代表任何真实模型成绩，也没有得到 EvalHub 或上游作者核验。真实提交必须另建 JSON，不能修改或冒充这个示例。示例里的 `total_tasks` 固定为 89，与 `terminal-bench-2-1` 仓库 `tasks/` 下的任务目录数一致；转换器只接受该值。

从 evals 仓库根目录运行合成自测：

```bash
node evals/terminal-bench-harbor/pack-to-result.mjs \
  evals/terminal-bench-harbor/tasks/example-submission.json \
  --out /tmp/terminal-bench-harbor-example-result.json
```

转换器要求恰好三次运行，并按声明顺序输出运行明细与数值 mean@3。运行数不为 3、run ID 重复、artifact_url 重复、SHA-256 重复、`total_tasks` 不等于 89、`resolved_tasks` 超出 `total_tasks`、非整数计数、本机或 IP 地址、带 query 或 fragment 的 URL、非法 SHA-256 都会被拒绝。转换失败时不会留下 `null` 或部分分数结果。

[`terminal-bench-official-results-2026-08-05.json`](terminal-bench-official-results-2026-08-05.json) 是官网 Terminal-Bench 2.1 榜单的事实快照，包含 17 条成绩、官网名次、accuracy、accuracy_stderr、n_trials、`pass@2` 至 `pass@5`、官网标注日期与来源页面 SHA-256，数值取自页面内嵌数据的原始精度。它不是 custom runner 的输入，也不表示 EvalHub 独立复跑。`accuracy_stderr` 是官网发布的标准误，不是 95% 置信区间半宽；`../official-result-to-envelope.mjs` 不会把它换算成置信区间，也不会由百分比反推每题成败计数。该生成器只接受快照中的 17 个固定 `participant_id`，并在生成 `upstream_author_publication` 结果前重新校验结构、身份唯一性、数值范围、日期格式，以及共享结果 schema 与本目录 `eval.yaml` 的上下文校验，且 `score` 必须为数值。
