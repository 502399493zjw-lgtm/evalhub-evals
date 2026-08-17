# RSIBench-Data（数据中心型后训练研究）

这套评测问一件事：给你一个外围训练服务与评测链路都被钉死的流水线，你的 Agent 能不能靠
**合成训练数据并在白名单内调整训练配置**，把一个未微调的基座模型推上去。

参赛主体不是被训练的模型，而是做研究的 Agent。目标模型固定为
`Qwen/Qwen3.5-35B-A3B-Base`，训练后端固定 Tinker LoRA SFT，采样走 tinker:// 检查点，
工具调用走 E2B 代理沙箱，官方复评走 Harbor。协议允许 Agent 改动两类内容：写入
`train_messages.jsonl` 的训练数据，以及受限白名单里的训练配置；目标模型、训练后端、
服务链路和评测器不允许替换。这样能显著减少基础设施差异带来的混杂。

在名义每次运行 16 小时墙钟、500 USD Tinker 额度的预算内，Agent 要自己决定造什么数据、
怎么用评测反馈迭代、什么时候停下来选定检查点。检查点必须在官方复评**之前**选定——
不允许先看复评结果再回头挑检查点。

## 被计分的是什么

六个 profile 各跑一次独立的预算运行，每次运行的分项分数是官方复评的通过率：

| 分项 | 评测 agent | 锁定分母 | 权重 |
| --- | --- | --- | --- |
| SWE-bench Verified | mini-swe-agent | 100 题 × 1 次解码 | 0.2 |
| SWE-bench Multilingual | mini-swe-agent | 100 题 × 1 次解码 | 0.2 |
| SWE-bench Pro | mini-swe-agent | 100 题 × 1 次解码 | 0.2 |
| Terminal-Bench 2.0 | terminus-2 | 89 题 × 1 次解码 | 0.2 |
| GPQA Diamond | terminus-2 | 100 题 × 1 次解码 | 0.1 |
| AIME 2026 | terminus-2 | 30 题 × 4 次解码 | 0.1 |

分项分数 = 通过数 ÷ 锁定分母 × 100。主分数 = 六项分项分数按上表权重加权求和，满分 100 分，
单位「分」，排名只看这一个数。

分母、权重和预算上限全部写死在 `pack-to-result.mjs` 里，不接受提交方覆盖。清单里声明的
分母只是被拿去和内置值比对，不一致就直接转换失败——这样改分母抬分这条路是走不通的。

三条硬性前提，任一不满足该次运行即不成立：

- 评测题目及其产物不得转化为训练监督（`data_isolation_audit` 必须为 `passed`）
- 检查点必须在官方复评前选定（`checkpoint_selected_before_official_eval` 只接受 `true`）
- 单次运行不得超过 16 小时墙钟与 500 USD Tinker 额度

## 分数怎么读

未微调的 `Qwen/Qwen3.5-35B-A3B-Base` 六项分数按官网同一公式计算出的**派生基线**是
13.124 分，官方榜单上目前
最高的研究者 Agent 是 27.317 分。所以这套评测的有效区间很窄：20 分出头已经是能把基座
明显推起来的水平，30 分以上目前还没有人做到。SWE-bench Pro 那一列的未微调基线是 0.00%；
这只是官方矩阵中的事实，仍应和其余五个 profile 一起解读。

值得注意的是分数不是单调向上的——官方候选轨迹图显示，多数运行在触及历史最佳之后继续
搜索，最后却收在更低的候选上。知道什么时候停手，本身就是被考的能力之一。

## 本地怎么跑

本评测 `runner: custom`、`custom_mode: external_workflow`。转换器不跑模型、不联网、
不读环境变量，只把一份提交清单换算成结果信封：

```bash
node evals/rsibench-data/pack-to-result.mjs <submission.json> --out <result.json>
```

清单字段说明和一份可直接跑通的结构示例在 `tasks/README.md` 与
`tasks/example-submission.json`。转换器会拒绝清单里任何未列出的字段，并在写出结果前
用 `ResultFileSchema` 和本评测契约自校验一遍，两道都过才落盘。

## 来源与边界

以下是中立事实陈述，请连同上面的评测说明一起读。

**上游出处。** 协议、六个 profile 规格、固定训练与评测链路、数据隔离规则和研究者 Agent
提示词全部来自 Evolvent AI 的 RSIBench-Data 项目：

- 官方作者仓库 https://github.com/evolvent-ai/RSIBench-Data ，本条目钉死在 commit
  `4c807610243e7b481d382c5ed360c71c79a22f61`
- 论文 arXiv:2607.25886v1，2026-07-28 提交
- 官方研究文章 https://evolvent.co/en/research/RSIBench-Data ，2026-07-29 发布
- 官方榜单页 https://evolvent.co/en/leaderboard
- 官方矩阵页 https://rsibench.co/data/

`eval.yaml` 里的六份 agent 提示词是上游对应 profile 提示词的转录；详情页确定性选中的
5 个题目案例带完整中文 `translation`，未展示的 SWE-bench Pro 不额外保存译文。`run_spec`
是按上游 `benchmarks/<key>/spec.json` 转录的复评配置。分母
100/100/100/89/100 与 30×4 同样转录自这些 spec，权重 0.2/0.2/0.2/0.2/0.1/0.1 转录自官方
榜单页。

**授权边界。** 作者仓库 README 的许可证徽章指向 CC BY-NC 4.0，但钉死的 commit 上**没有**
独立 LICENSE 文件，GitHub API 也未识别出许可证；论文 v1 标注 CC BY 4.0，官方文章页及其
托管图片则没有另列许可。本条目因此按最保守的方式处理：只转录运行协议所必需的规格与
提示词文本，三张论文图一律 HTTPS 引用采用 CC BY 4.0 的 arXiv v1 版本而不在本仓库转存副本（见
`assets/README.md`），也不复制任何题目数据集。被评的题目集合由上游 Harbor 数据集与
本地 seed-23 子集抽样决定，参赛方在自己的运行环境里取得。

**EvalHub 与上游没有官方关系。** 本条目是把上游已公开发表的协议与成绩整理进 EvalHub，
未经 Evolvent AI 官方认证或背书，也不代表上游作者的立场。

**分项与前三名总分是上游发表值；另外两个总分按官网公式派生，均不是 EvalHub 复跑。**
`published-results/official-leaderboard-2026-08-09.json` 里五个参赛条目全部标记为
`upstream_author_publication`，来源是 2026-08-09 抓取的官方榜单页快照
（`snapshot_sha256` 记在信封里）。它们不带 `usage`、`task_results` 或 `showcases`，
因为 EvalHub 没有独立跑过这些运行，没有逐题结果可展示。

三点需要明确标注的边界：

1. 官方榜单页只直接显示前三名的加权总分（27.317 / 27.277 / 23.441）。另外两个条目的
   总分（22.305 / 22.005）是用官方同一份权重和官方分项成绩算出来的**派生值**，信封的
   `detail` 里逐字写明了这一点，没有当成官方逐字发表值。用官方权重回算前三名能精确复现
   官方显示的三个数，这是判定该公式为官方口径的依据。
2. 榜单页与 rsibench.co 矩阵页重叠的 Base model 与论文四个 Agent 共 30 个分项成绩逐格一致；
   Kimi 的六格只见于后续榜单。两页重叠部分只有两格成本数字不同
   （gpt-5.6-sol 的 AIME 63.65 对 63.87，Sonnet-5 的 Terminal-Bench 2.0 156.93 对
   157.85）。本条目采用榜单页的值并在表注里披露差异，没有取平均。
3. Kimi K3 那一条在来源里没有发表任何用时与成本数据。为了让详情页把论文四个 Agent 已发表的
   24 组资源数据与对应分项正确对齐，结果信封把资源列并入同一张分项表；Kimi 的对应单元格保持
   JSON `null` 并显示为“—”，不表示 0，也没有用其他条目的数字补齐。

**sample-result.json 只是结构示例。** 它是把 `tasks/example-submission.json` 喂给转换器
得到的输出，participant 是刻意造的 `example/synthetic-research-agent`，六个通过数是为了
演示算分而选的示例整数，不来自任何来源、不对应任何模型，也不是官方成绩或 EvalHub 复跑。

## 目录内容

```text
evals/rsibench-data/
├── AUTHORS                                  投稿人 GitHub handle
├── README.md                                本文件
├── eval.yaml                                评测定义、六个 profile、detail_profile
├── pack-to-result.mjs                       自定义转换器（无网络、无进程、无环境变量）
├── sample-result.json                       结果信封的结构示例
├── assets/README.md                         官方研究图的引用方式与授权说明
├── tasks/
│   ├── README.md                            提交清单字段说明
│   └── example-submission.json              可跑通的结构示例清单
└── published-results/
    └── official-leaderboard-2026-08-09.json 官方榜单五个条目的转录
```
