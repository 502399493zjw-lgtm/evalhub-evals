# Terminal-Bench 3.0

Terminal-Bench 3.0 用 74 个长时程终端任务评估 Agent 在真实工具环境中完成工作的能力。任务不要求只输出一段自然语言答案：Agent 往往要先探索容器里的文件和程序，再编写或修复代码、调用系统与专业工具、处理运行错误，并让题目自带的测试或验证器确认最终产物。

本目录固定到：

- Terminal-Bench tag `v3.0.0`，commit `2b0442c3c583b710ca8da14c8e601b99f2f1f244`
- Harbor tag `v0.20.0`，commit `459ff6ec99417589b7f679d14ddf3b3f0ae4f1dc`
- 74 个任务，每个 Agent 每题独立运行 5 次
- 370 个有限 `[0,1]` reward 的算术平均，换算成 0–100 分；题目既可以产生二元 reward，也可以产生连续 reward

## 来源台账

| 一手来源 | 本目录采用的事实 | 映射位置 | 版本或许可边界 |
| --- | --- | --- | --- |
| [Terminal-Bench 固定源码](https://github.com/harbor-framework/terminal-bench/tree/2b0442c3c583b710ca8da14c8e601b99f2f1f244) | 题面、任务目录、上游说明、贡献者署名 | `upstream`、`references`、`detail_profile`、`tasks[].prompt` | 运行协议与任务身份只采用该 commit；许可与再分发边界单独记录在下方许可来源 |
| [v3.0.0 数据集清单](https://github.com/harbor-framework/terminal-bench/blob/2b0442c3c583b710ca8da14c8e601b99f2f1f244/tasks/dataset.toml) | 数据集名 `terminal-bench/terminal-bench-3`、74 个任务 ID 与内容 digest、数据集作者 | 任务 allowlist、任务数、固定分母 | 本目录只转录 `instruction.md`，不搬运清单指向的完整任务包 |
| [v3.0.0 README](https://github.com/harbor-framework/terminal-bench/blob/2b0442c3c583b710ca8da14c8e601b99f2f1f244/README.md) | 上游用 `-n 5` 做五次 oracle 环境验证的示例；项目领导、评审与任务作者 | 详情页上游示例与署名 | 五次参赛 Agent 尝试是本 EvalHub 协议的独立选择，不把 oracle 示例误述为上游强制参赛规则 |
| [Harbor v0.20.0 固定源码](https://github.com/harbor-framework/harbor/tree/459ff6ec99417589b7f679d14ddf3b3f0ae4f1dc) | `n_attempts` 的多次尝试语义、未声明 metric 时的默认 Mean 聚合、缺失 reward 按 0 进入聚合 | `run_spec`、转换器和主分公式 | 只采用固定 commit 的执行与聚合语义 |
| [Harbor Terminal-Bench 文档](https://harborframework.com/docs/running-tbench) | Harbor 的安装、数据集、Agent、模型、并发和环境入口 | README 的外部运行说明、详情页资料 | 文档是运行入口；可比性仍以固定源码和任务 digest 为准 |
| [Apache-2.0 许可 commit](https://github.com/harbor-framework/terminal-bench/commit/6dac399a3ebd34efbc675c03eb9f88ccf5dae047) | 上游项目根许可证，以及该许可树中的 74 个题面文本 | `LICENSE`、`THIRD_PARTY_NOTICES.md`、`detail_profile.caveats` 与本节 | 该 commit 晚于 v3.0.0；相较固定 tag，只改动根 `LICENSE` 与 README，`dataset.toml` 和 74 个 `instruction.md` 逐字节无差异 |

上游仓库由 GitHub 组织 [`harbor-framework`](https://github.com/harbor-framework) 托管。固定 tag 的 README 把 Ryan Marten、Alex Shaw、Andy Konwinski 和 Ludwig Schmidt 列为 Project Leadership，并另列 Senior Reviewers 与全部 Task Authors；`tasks/dataset.toml` 把 Ryan Marten、Ivan Bercovich 和 Alex Shaw 列为数据集作者。`AUTHORS` 用于登记上游项目的组织名或作者名，本目录据此填写 `@harbor-framework`；详细署名仍以上游固定版本 README 与 `tasks/dataset.toml` 为准。该登记不表示上游组织已认证或背书本次 EvalHub 投稿。

## 固定运行协议

这是 `runner: custom`、`custom_mode: external_workflow` 的评测。EvalHub 中的 `pack-to-result.mjs` 不启动 Agent、不下载数据、不运行 Harbor、容器或测试；真实评测先由提交者在自己的基础设施中完成，再把每次运行的最终 reward 打包成 EvalHub 结果。

运行者应先审阅固定版本的上游源码和任务内容，再按 Harbor 文档配置所需的容器/云环境、网络、GPU、编译器、专业软件和权限。固定 Harbor 可按如下形式安装；实际 Agent、模型、环境与并发参数由运行者选择并记录：

```bash
uv tool install "harbor[modal] @ git+https://github.com/harbor-framework/harbor.git@459ff6ec99417589b7f679d14ddf3b3f0ae4f1dc"
harbor run -d terminal-bench/terminal-bench-3 -n 5 --agent <agent> --model <model> <其他已记录参数>
```

执行时必须满足：

1. 任务集合与内容 digest 对齐固定 `tasks/dataset.toml`，不得替换题目容器、测试、solution、时间限制或 reward 逻辑。
2. 同一个 Agent 对 74 个任务各运行 5 次独立尝试，不能只保留最好的一次。
3. 每次尝试从该 trial 的原始 `result.json.verifier_result.rewards` 提取 `reward` 字段；只接受有限 JSON number，且必须满足 `0 <= reward <= 1`。同时对未经重排、格式化或重写的同一份 `result.json` 原始字节计算 `result_sha256`。例如 `erp-procurement-planning` 与 `kv-live-surgery` 的 verifier 可以产生连续 reward。
4. 超时、Agent/容器/环境失败，以及 Harbor 产物中缺失、为 `None` 或没有可用 `reward` 字段的结果，都必须在提交清单中显式写成 `0`。
5. 每条 trial 的 `trial_id` 取自同名 trial 目录中的 `result.json.id`，`trial_name` 取自 `result.json.trial_name`，并核对它与 trial 目录名一致。`task_digest` 必须取自该 trial 的原始 `lock.json > task.digest`；同时对同一份 `lock.json` 原始字节计算 `lock_sha256`。不要使用已过时的 `result.json.task_checksum` 代替它。
6. 保存 Harbor job 标识、运行参数、原始日志、370 对 `result.json`/`lock.json` 和其余产物，并给完整证据包计算 SHA-256。`harbor_job.job_id` 必须是 Harbor 的真实 canonical UUID；`evidence_sha256` 是证据包入口。接纳成绩前，评测作者要从包内逐 trial 重算两个文件摘要，并用同一文件内容复核 reward、ID、名称和 task digest。
7. 转换器只接收清单，不读取证据包，也不会自行重算文件摘要；它会拒绝缺失、格式错误、明显占位或关系冲突的摘要，并把每对摘要保留到结果中。清单字段本身不能替代第 6 步的外部证据核验。
8. 不得把 pass@k、提交方自算 aggregate、自定分母或删减任务后的比例作为 EvalHub 主成绩。

Harbor 的真实安装与运行可能需要联网和外部算力。运行者应自行审阅代码，并决定是否使用容器、虚拟机、网络隔离或其他安全措施；本目录的静态检查不是安全审计，也不担保第三方 runner 可在任意环境中运行。

## 主成绩

固定分母为：

```text
74 tasks × 5 trials = 370 rewards
```

主成绩为：

```text
score = sum(reward) / 370 × 100
```

固定 Terminal-Bench `tasks/dataset.toml` 没有声明 metric，固定 tag 也没有数据集级 `tasks/metric.py`；因此 Harbor v0.20.0 按 [`job.py`](https://github.com/harbor-framework/harbor/blob/459ff6ec99417589b7f679d14ddf3b3f0ae4f1dc/src/harbor/job.py) 追加默认 `Mean`，再由 [`mean.py`](https://github.com/harbor-framework/harbor/blob/459ff6ec99417589b7f679d14ddf3b3f0ae4f1dc/src/harbor/metrics/mean.py) 对 reward 做算术平均。这里复现的是该固定协议，不采用其他榜单或未合并提案另行定义的二值 accuracy。

每个任务等权，每个 trial 也等权。reward 总和为 `185`（例如合成样例中的 185 个单位 reward）对应 50 分；真实连续 reward 不应被四舍五入为二元值。转换器会输出 370 条 `task_results`：每个任务 ID 恰好出现 5 次，每条逐次成绩为 `reward × 100`，并在 `raw` 中写明派生展示序号、真实 Harbor UUID、trial 名称、固定 task digest、`result_sha256` 与 `lock_sha256`。

清单中 trial 数组的输入顺序没有 attempt 序号语义；转换器按每题 `trial_id` 的 ASCII 字典序排序后，再派生展示序号 `1–5`。因此，作者必须先核对每个真实 Harbor 产物的身份，再填写清单，不能把数组位置当作 Harbor 的 attempt ID。

`pass@k` 可以另行用于分析同一任务多次运行的稳定性，但它不是这里的主排名指标。提交者不能通过遗漏失败尝试或覆盖分母改变主分。

`scored_by: author` 表示评测作者要在接纳成绩前核对 Harbor job、运行配置、日志、逐 trial 文件摘要与证据包；`score_policy: required` 表示转换器只会生成数值成绩，不接受先提交 `null` 再补分。

## 提交清单与转换

完整格式见 [`tasks/example-submission.json`](tasks/example-submission.json) 和 [`tasks/README.md`](tasks/README.md)。打包命令由 `eval.yaml` 的 `command_template` 固定为：

```bash
node evals/terminal-bench/pack-to-result.mjs <submission.json> --out <result.json>
```

转换器：

- 输入上限 1 MiB，只接受合法 UTF-8 与 JSON，并拒绝任何层级的重复 JSON 字段；
- 对根对象、participant、Harbor job、任务和 trial 逐层使用字段 allowlist；
- 钉死 manifest v2、eval ID、协议版本、Terminal-Bench commit、Harbor 版本与 Harbor commit；
- 要求 Harbor job 与每个 trial 使用非 nil 的 lowercase canonical UUIDv4；370 个 `trial_id` 与 `trial_name` 必须全局唯一，且 trial ID 不能等于 job ID；
- 要求 74 个任务完整覆盖、每题恰好 5 个 trial，并精确匹配内置的 `task_digest`；
- 每条 trial 必须提供小写 `result_sha256` 与 `lock_sha256`；370 个 result 摘要必须唯一，lock 摘要只允许在同一任务内重复，且 result/lock 摘要不能互相冒用；
- 要求 `trial_name` 符合 Harbor 默认的 `<task-slug 截断>__<7-char ShortUUID>` 形状；
- reward 必须是有限 JSON number 且在 `[0,1]` 内；布尔值、字符串、`null` 和越界值均失败；
- trial 输入顺序无语义；输出按真实 `trial_id` 排序并派生展示序号；
- 不接受 `score`、`aggregate`、`denominator`、`pass@k` 等提交方声明；
- 生成后依次通过 `ResultFileSchema` 和 `validateResultForEval`；
- 输入使用文件描述符读取，读取前后核对 inode、大小与纳秒时间戳，拒绝输入软链接、父目录别名以及与输出相同的硬链接；
- 最后在真实输出目录中以随机 `wx` 临时文件写出，依次 `fsync` 临时文件、rename 并 `fsync` 父目录；失败时只清理自己尚未 rename 的临时文件。

转换器不联网、不执行子进程、不读取环境变量，也不会读取或重算证据包中的文件摘要。证据真实性及清单到原始文件的实际绑定仍由评测作者在转换器之外核对。

## 示例不是实跑成绩

`tasks/example-submission.json` 是纯合成结构样例，使用交替的 0/1 reward，故意得到 `185/370 = 50` 分；其中的 participant、Harbor UUID、trial UUID/name、job 级 evidence hash 及逐 trial result/lock hash 都是确定性合成示例值，没有对应真实 Harbor 运行或真实文件。

`sample-result.json` 由该示例清单通过本目录转换器生成，仅用于校验结果结构。它不是官方成绩、基线、EvalHub 复跑或模型能力声明，不能进入榜单或被当作比较依据。

## 公开成绩状态

本评测使用 `baseline_policy: required`，并在
[`published-results/official-leaderboard-2026-08-10.json`](published-results/official-leaderboard-2026-08-10.json)
中收录了 2026 年 8 月 10 日从 [Frontier-Bench 官方榜单](https://www.frontierbench.ai/)
快照转录的 7 条可识别 Terminal-Bench 3.0 成绩。`score` 使用来源页面的原始 accuracy
（百分制），`supplementary_views` 保留了官方展示成绩、标准误、发布日、总 token、成本和榜单行
标识，方便读者核对来源。

这些记录属于上游作者发表的汇总成绩，不是 EvalHub 独立复跑；由于来源没有公开逐题 Harbor
证据，结果文件不会伪造 `task_results`、`usage` 或模型输出。官方榜单中的
`anthropic/claude-opus-5` 与 `openai/gpt-5.6-luna` 暂未进入平台模型注册表，因此当前不写入
结果文件；待平台正式收录准确模型身份后再补回对应官方记录。官方 Terminal-Bench 2.1 榜单
使用不同的 89 题协议，也不会与本目录的 3.0 结果混用。

## 许可与再分发边界

固定 tag `v3.0.0` 的仓库根目录当时没有 `LICENSE` 文件。上游随后在 2026 年 7 月 25 日的 commit [`6dac399a3ebd34efbc675c03eb9f88ccf5dae047`](https://github.com/harbor-framework/terminal-bench/commit/6dac399a3ebd34efbc675c03eb9f88ccf5dae047) 加入项目根 Apache License 2.0。运行协议和任务身份仍固定到 `v3.0.0`；本目录实际转录的题面字节也存在于 `6dac399…` 的许可树中，并已核对全部 74 个 `tasks/*/instruction.md` 与 `v3.0.0` 逐字节相同。`LICENSE` 是该 commit 根许可证的逐字副本。

其中 8 个题面来自带 Scale AI, Inc. 任务级 `LICENSE.md` 的目录；本目录在 `THIRD_PARTY_NOTICES.md` 中列出固定来源链接并逐字保留这些归属与许可文本。本目录只转录执行协议所必需的 74 个 `instruction.md` 题面文本，并原样保留其中的 Harbor canary 注释。没有复制上游容器、环境文件、测试、校验器、solution、数据集、模型产物、压缩包、二进制资产或第三方媒体。任何真实运行者都应直接从上游固定版本取得其余任务内容，并逐项遵守项目根许可证、任务级许可证和第三方通知。

本 EvalHub 映射没有获得 Harbor、Terminal-Bench、Frontier-Bench、`harbor-framework` 或任何上游贡献者的认证与背书。

## 目录

```text
evals/terminal-bench/
├── AUTHORS
├── LICENSE
├── README.md
├── THIRD_PARTY_NOTICES.md
├── assets/
│   └── README.md
├── eval.yaml
├── pack-to-result.mjs
├── sample-result.json
└── tasks/
    ├── README.md
    └── example-submission.json
```
