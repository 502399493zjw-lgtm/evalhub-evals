# Tasks

E-Commerce Bench 是单任务、长时程 Agent 评测。canonical 题面逐字保存在 `eval.yaml` 的 `tasks[0].prompt`；固定运行参数在同一任务的 `run_spec` 中。

## 为什么使用 external_workflow

完整评测要运行上游 Python 商业模拟器，并访问参赛模型与供应商 NPC 的外部 API。EvalHub 投稿仓库的无网络验证环境不适合承载这些调用，因此本目录不伪装成本地可执行 benchmark：真实五次 episode 在提交者基础设施中完成，仓库里的转换器只检查摘要清单并封装结果。

## 清单字段

`example-submission.json` 的数值完全虚构，只验证结构。清单固定 `manifest_version=1`、`eval_id=e-commercebench`、`protocol_revision=1`、上游 commit、365 天、10 万元初始本金和五次运行。每次运行记录唯一 ID、结束日、规范化终止状态、是否破产、年末/终止时总资产、工具调用数、Agent turn 数和证据包 sha256。

`env_completed` 必须在第 365 天结束且不能标记破产；`env_terminated` 表示上游提前结束，破产只是其中一种可能。五次运行无论是否提前结束都进入平均值。转换器拒绝未知字段、重复运行 ID、非有限数字、错误 commit、错误运行次数以及不一致的终止语义。

转换示例：

```bash
node evals/e-commercebench/pack-to-result.mjs evals/e-commercebench/tasks/example-submission.json --out e-commercebench-result.json
```
