# 提交清单格式

本评测是 `custom_mode: external_workflow`：评测本身在你自己的基础设施上按上游协议跑（上游
推荐 Harbor + Modal 或 Daytona，74 题里有 4 题需要 GPU），跑完后把逐题判定整理成一份 JSON
清单，交给转换器换算成结果信封。

```bash
node evals/terminal-bench-3/pack-to-result.mjs <你的清单>.json --out terminal-bench-3-result.json
```

转换器不联网、不起子进程、不读环境变量、不调用任何模型服务，只校验清单、按内置分母算分、
原子写出信封。

## 顶层字段

清单必须是一个 JSON 对象，且**只能**含下列字段，多一个键就报错：

| 字段 | 取值 |
| --- | --- |
| `manifest_version` | 固定整数 `1` |
| `eval_id` | 固定 `"terminal-bench-3"` |
| `protocol_revision` | 固定整数 `1`，须与 `eval.yaml` 的 `protocol_revision` 一致 |
| `upstream_commit` | 固定 `"2b0442c3c583b710ca8da14c8e601b99f2f1f244"`（tag `v3.0.0`） |
| `upstream_dataset` | 固定 `"frontier-bench/frontier-bench"` |
| `participant` | 参赛身份，见下 |
| `run_date` | 真实存在的日期，`YYYY-MM-DD` |
| `harbor_job` | 运行标识与证据指纹，见下 |
| `tasks` | 长度必须为 74 的数组，见下 |

### `participant`

| 字段 | 说明 |
| --- | --- |
| `model` | 被评模型的具体名字，例如 `"Claude Fable 5"`。必填 |
| `harness` | 编排它的 agent/产品，例如 `"Claude Code"`、`"Codex"`、`"Cursor CLI"`。必填 |
| `harness_version` | harness 版本。必填——真实运行的信封里 `harness` 与 `harness_version` 必须成对出现 |

### `harbor_job`

| 字段 | 说明 |
| --- | --- |
| `job_id` | Harbor 的 job 路径或标识，供作者核对公开 artifact |
| `evidence_sha256` | 你留档的运行证据包的 64 位小写 sha256 |

### `tasks[]`

必须恰好 74 条，`task_id` 必须是 `eval.yaml` 里那 74 个 ID，不重复、不缺、不多：

| 字段 | 说明 |
| --- | --- |
| `task_id` | 上游任务目录名，例如 `"wal-recovery-ordering"` |
| `passed` | 布尔值。上游 `reward = 1.0` 记 `true`，其余一律 `false`。不接受部分分 |
| `verifier_separate` | 只接受 `true`：判分必须在与 Agent 隔离的独立 verifier 容器内完成 |

## 算分

主分数 = `passed` 为 `true` 的条数 ÷ 74 × 100，保留六位小数。分母 74 和 74 个任务 ID 都写死在
转换器里，清单与内置值不一致就转换失败。

转换器还会输出一张「本次分域」表：按 `eval.yaml` 里每题的域标注把 74 题汇总成七个域的通过率。
这是 EvalHub 为了让主分数可分项复核而算的，上游官方榜单不发表分域成绩。

## 会被拒绝的清单

- 含任何未列出的字段
- `tasks` 长度不是 74、有重复 `task_id`、或出现不属于本评测的 `task_id`
- `passed` 不是布尔值（例如填了 0.5 这样的部分分）
- 任一条 `verifier_separate` 不是 `true`
- `upstream_commit` / `upstream_dataset` / `eval_id` / `protocol_revision` 与钉死值不符
- `run_date` 不是真实日期（例如 `2026-02-29`）
- `harbor_job.evidence_sha256` 不是 64 位小写十六进制

## `example-submission.json`

同目录下的 `example-submission.json` 是一份**合成的结构示例**，也是 CI 沙箱用来测试转换器的
固定输入。它的 participant 是刻意造的 `example/synthetic-terminal-agent`，74 条通过/失败按
"每第 5 题通过"的固定规则生成（15/74 → 20.27027 分），不来自任何来源、不对应任何模型，
也不是官方成绩或真实复跑。真实提交请用 `evalhub pack` 显式传入你自己的 `--input` 文件。
