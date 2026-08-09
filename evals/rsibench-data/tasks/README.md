# 题目与提交清单

本目录说明六个 profile 的题面来自哪里，以及转换器接受什么形状的提交清单。

## 六个 profile

`eval.yaml` 的 `tasks` 里有六条，`id` 与上游 `benchmarks/<key>/` 一一对应：

| task_id | 评测 agent | 锁定分母 | 权重 |
| --- | --- | --- | --- |
| `swe-bench-verified` | mini-swe-agent | 100 题 × 1 次解码 | 0.2 |
| `swe-bench-multilingual` | mini-swe-agent | 100 题 × 1 次解码 | 0.2 |
| `swe-bench-pro` | mini-swe-agent | 100 题 × 1 次解码 | 0.2 |
| `terminal-bench-2` | terminus-2 | 89 题 × 1 次解码 | 0.2 |
| `gpqa-diamond` | terminus-2 | 100 题 × 1 次解码 | 0.1 |
| `aime` | terminus-2 | 30 题 × 4 次解码 | 0.1 |

每条 task 的 `prompt` 是上游对应 profile 的 agent 提示词，`translation` 是中文对照，
`run_spec` 写明该 profile 的官方复评配置与分项分数算法。三个 SWE profile 共用同一份上游
提示词，profile 差异由上游 `spec.json` 决定，不由提示词决定。

题面本身不在本目录内联复制：被评的题目集合由上游 Harbor 数据集与本地 seed-23 子集抽样
决定，参赛方按 `run_spec` 在自己的运行环境里取得，本仓库只固定分母、评测 agent 与算分口径。

## 提交清单格式

本评测 `runner: custom`、`custom_mode: external_workflow`。转换器不跑模型、不联网，只做
一件事：读入一份提交清单，按内置分母与权重算分，写出结果信封。

```text
node evals/rsibench-data/pack-to-result.mjs <submission.json> --out <result.json>
```

清单顶层字段：

- `manifest_version`：目前只接受 `1`
- `eval_id`：必须是 `rsibench-data`
- `protocol_revision`：必须是 `1`
- `upstream_commit`：必须是本评测钉死的来源 commit `4c807610243e7b481d382c5ed360c71c79a22f61`
- `target_model`：必须是 `Qwen/Qwen3.5-35B-A3B-Base`
- `participant`：`model`（不含空格的编排模型标识）、`harness`、`harness_version`；
  `model` 不能填目标模型，因为参赛主体是研究者 Agent，不是被微调的目标模型
- `run_date`：`YYYY-MM-DD`，且必须是真实存在的日期
- `runs`：长度必须为 6 的数组，六个 profile 各一条

每条 run 字段：

- `task_id`：上表六个之一，不可重复
- `run_id`：`^[A-Za-z0-9._-]{3,128}$`
- `checkpoint`：`tinker://…` 形式的采样检查点
- `checkpoint_selected_before_official_eval`：只接受 `true`
- `data_isolation_audit`：只接受 `"passed"`
- `official_eval`：`passed`、`n_tasks`、`n_attempts`；后两者必须与上表锁定分母一致
- `budget`：`wall_clock_hours`（上限 16）、`tinker_cost_usd`（上限 500）
- `evidence_sha256`：该次运行证据包的 64 位小写十六进制摘要

转换器拒绝任何未列出的字段，也拒绝提交方自带的分母、权重或预算上限——这三样都写死在
转换器里，避免用改分母的方式抬分。清单里声明的分母只是被拿去和内置值比对，不参与计算。

## example-submission.json

`example-submission.json` 是一份结构示例，唯一用途是演示上面这些字段怎么填、并让本地
校验能跑通一次真实转换。它不是任何真实运行的成绩：

- `participant.model` 是 `example/synthetic-research-agent`，一个刻意造的合成标识
- 六个 `passed` 是为了演示算分而选的示例整数，不来自任何来源，也不对应任何模型
- 六个 `evidence_sha256` 是固定占位字符串
  `rsibench-data example evidence placeholder: <task_id>` 的 sha256，可复算，
  这样任何人都能确认它们只是占位符，而不是被当成真实证据包摘要

同理，仓库根下的 `sample-result.json` 就是把这份示例清单喂给转换器得到的输出，用来展示
结果信封的结构。它不是官方成绩，也不代表 EvalHub 做过独立复跑。真实的官方成绩在
`published-results/` 里，并且明确标了来源与抓取日期。
