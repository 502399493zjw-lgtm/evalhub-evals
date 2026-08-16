# tasks

本评测只有一道题：在上游 NovaMind 模拟器里以 CEO 身份连续经营 500 个模拟日。题面原文见
`eval.yaml` 的 `tasks[0].prompt`（逐字取自上游 pinned commit 的
`src/saas_bench/agents/simulator_instructions.md`，`{total_days}` 等模板占位符原样保留），
EvalHub 为可复现补充的固定配置写在同一条任务的 `run_spec` 里。

## 为什么是 external_workflow

模拟器需要 SQLCipher 数据库、上游 Python 依赖和参赛 Agent 自己的模型调用，这些都不可能在本仓库
的无网络只读沙箱里跑起来。因此实际运行发生在参赛方自己的基础设施上，本仓库的 `.mjs` 只做一件事：
把运行结果清单转换成 EvalHub 结果结构，并在结构、协议边界与数值范围不合法时拒绝出分。

## 上游运行路线与环境边界

本条目协议的主来源是 `zlab-princeton/ceobench-src` commit
`d2b7b32e5301a571b77f5f68bd1032adbcd5b464`。公开的 coding-agent CLI 运行参考是
`zlab-princeton/run-ceobench` commit `885ae1d7d09b3effa08825ce7f03075224ebe373`；它提供实际会话入口，
但不替换 `eval.yaml` 中的 canonical prompt，也不修改 protocol revision 1。

固定 `run-ceobench` 版本要求 Python 3.13+：

```bash
pip install -r requirements.txt
./novamind-operation new-session --days 500 --seed 42
```

会话输入包括 CLI/API 经营动作、每周理由和四个期限的现金预测；输出包括 `session_id`、状态、历史、
ledger 与结束现金。上游只允许创建一个会话，并禁止查看 `world.nmdb` 或 `novamind-operation` 的内部
内容。EvalHub 的三次运行要求应由三个隔离的新任务实例分别完成，不能绕过上游的一次会话限制。

运行需要本机文件读写和子进程权限、Python 与 SQLCipher 依赖、模型调用网络和凭证，以及相应时间、
算力和费用。第三方 runner 未在本次 readiness 中执行，runtime verification 为 `unverified`；仓库验证
只覆盖元数据、转换器输入输出和结果 schema，不是运行兼容性或安全审计。

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

```bash
node evals/ceo-bench/pack-to-result.mjs evals/ceo-bench/tasks/example-submission.json --out ceo-bench-result.json
```

转换器输入是上表定义的 JSON 清单，输出是一个 `ceo-bench` result-v1 JSON 信封。它不读取上游会话
目录或数据库；参赛方负责从真实运行记录中生成并审查清单、去除凭证，再保存对应证据包哈希。
