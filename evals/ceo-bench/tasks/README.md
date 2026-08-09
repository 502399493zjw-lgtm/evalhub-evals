# tasks

本评测只有一道题：在上游 NovaMind 模拟器里以 CEO 身份连续经营 500 个模拟日。题面原文见
`eval.yaml` 的 `tasks[0].prompt`（逐字取自上游 pinned commit 的
`src/saas_bench/agents/simulator_instructions.md`，`{total_days}` 等模板占位符原样保留），
EvalHub 为可复现补充的固定配置写在同一条任务的 `run_spec` 里。

## 为什么是 external_workflow

模拟器需要 SQLCipher 数据库、上游 Python 依赖和参赛 Agent 自己的模型调用，这些都不可能在本仓库
的无网络只读沙箱里跑起来。因此实际运行发生在参赛方自己的基础设施上，本仓库的 `.mjs` 只做一件事：
把运行结果清单转换成 EvalHub 结果结构，并在结构、协议边界与数值范围不合法时拒绝出分。

## 提交清单格式

`example-submission.json` 是这份清单的结构示例（数值是为了跑通结构而虚构的，不是任何模型的成绩，
也不是官方成绩）。字段含义：

| 字段 | 含义 |
| --- | --- |
| `manifest_version` | 固定 `1` |
| `eval_id` | 固定 `ceo-bench` |
| `protocol_revision` | 必须等于 `eval.yaml` 的 `protocol_revision` |
| `upstream_commit` | 必须等于本评测钉死的上游 commit |
| `simulation.days` | 固定 `500` |
| `simulation.initial_cash_usd` | 固定 `1000000` |
| `simulation.seed` | 固定 `42` |
| `simulation.scenario` | 固定 `default` |
| `participant.model` | 驱动 Agent 的模型标识 |
| `participant.harness` / `harness_version` | Agent 脚手架名称与版本 |
| `run_date` | 运行日期 `YYYY-MM-DD` |
| `runs` | 恰好 3 次独立运行，与上游「每个模型 3 次运行」一致 |
| `runs[].run_id` | 运行标识，3 次之间不得重复 |
| `runs[].days_survived` | 该次运行存活的模拟天数，1–500 的整数 |
| `runs[].bankrupt` | 是否因现金为负提前结束 |
| `runs[].ending_cash_usd` | 结束时的现金余额（USD） |
| `runs[].agent_turns` | 该次运行里 Agent 实际的操作轮数 |
| `runs[].evidence_sha256` | 该次运行证据包的 sha256（64 位小写十六进制） |

转换器会强制上游模拟器本身的终止语义，任一条不满足即转换失败：

- 破产运行必须 `days_survived < 500` 且 `ending_cash_usd < 0`（上游只有现金为负这一个破产触发条件）；
- 完成运行必须 `days_survived == 500` 且 `ending_cash_usd >= 0`；
- 清单里不得出现未知字段，`days` / `initial_cash_usd` / `seed` / `scenario` 不接受任何覆盖。

## 转换命令

```
node evals/ceo-bench/pack-to-result.mjs evals/ceo-bench/tasks/example-submission.json --out ceo-bench-result.json
```
