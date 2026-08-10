# Ego Browser Benchmark：真实世界任务集

本 EvalHub 评测固定使用上游 Real-World Bench 在提交
`f566ac293e4e6bd80c4e9b062b5699f04eac41f4` 的任务快照。它衡量浏览器智能体完成
31 个实用网页任务、154 项二元量规的能力。`eval.yaml` 中的 `prompt` 逐字保留固定上游
JSON 的英文原文，以维持协议不变；同一任务的 `translation` 提供中文阅读版本。这里不再
分发上游附件、浏览器产物、截图或运行轨迹。

## 主分数

**完美率（%）** = `100 × 全部量规通过的任务数 / 31`。分数越高越好。一道任务只有在其
全部来源量规通过时才贡献主分数，因此部分完成不获得主分数。量规平均分是已发布的补充指标，
不影响排名分数。

## 已发布成绩的边界

2026-08-04 的上游报告公布了 16 个模型的比较。本 EvalHub 成绩文件有意只包含一个
**有来源支撑的 13 模型子集**：这 13 个来源身份可解析为当前 EvalHub 注册表中的标准模型。
`Claude Opus 5`、`DeepSeek V4 Flash` 与 `ERNIE 5.1` 在投稿时没有可核验的标准注册表
身份，因而被完全排除；本包不为它们创建近似映射、EvalHub 排名、分数、任务结果、展示案例或
补充分项。因此，本 EvalHub 榜单不能替代上游报告完整的 16 模型排序。

成绩信封是固定报告的 `upstream_author_publication` 转录，而不是 EvalHub 独立复跑。它仅为
这 13 个已纳入身份收录上游发布的表现、执行、判定与计费视图，且有意不包含逐题结果、模型输出
或运行轨迹。

## 外部工作流与打包器

本评测使用 `runner: custom` 和 `custom_mode: external_workflow`。使用者须先在自己的环境
运行上游评测，再将所得 31 个 `all_rubrics_passed` 结论组成紧凑的清单，交给本地打包器：

```text
node evals/ego-browser-real-world-bench/pack-to-result.mjs <submission.json> --out <result.json>
```

打包器会校验固定任务集并计算主分数；它**不会**运行模型、启动浏览器、访问网站、发起网络请求、
读取上游运行目录或重新判定任何量规。`scored_by: author` 表示打包结果仍须由评测作者审阅原始
上游证据后才能认可。

固定提交中的上游工作流通常需要 Python 3.13+、`uv`、Node.js 22.13+、macOS Ego Browser
环境、模型提供方凭证和实时网络访问。上游文档中的典型命令为：

```text
uv run python run_eval.py --benchmark real-world-bench
uv run python run_judge.py --run-id <run_id>
```

部分来源任务需要登录账户，另有一道任务需要上游本地站点；真实网站也可能变化或实施反爬控制。
来源任务还可能触发表单交互或内容创建。运行前请审阅上游来源与任务行为，并自行选择合适的隔离、
账户与权限。EvalHub 不会执行、审计、担保或背书这一第三方工作流。

`tasks/example-submission.json` 和 `sample-result.json` 只是结构示例；其中全为 `false` 的结论
和合成参与者不代表任何模型运行或来源成绩。

## 来源、版本与许可证

- 上游仓库：https://github.com/citrolabs/ego-browser-benchmark-framework
- 固定来源提交：`f566ac293e4e6bd80c4e9b062b5699f04eac41f4`
- [固定版本的任务数据集](https://github.com/citrolabs/ego-browser-benchmark-framework/blob/f566ac293e4e6bd80c4e9b062b5699f04eac41f4/data/real_world_bench.json)（SHA-256：`e1495bef65b83c7bcb4cf3bf7a6e515239c6763c620efe1d31749ad6d54f6200`）
- [固定版本的官方报告](https://github.com/citrolabs/ego-browser-benchmark-framework/blob/f566ac293e4e6bd80c4e9b062b5699f04eac41f4/reports/ego-benchmark-model-metrics-2026-08-04.md)（SHA-256：`9d302fb27762c0885f6efa8292888e555babe3c71c9ed1e71247a982888cb611`）
- [MIT 许可证](https://github.com/citrolabs/ego-browser-benchmark-framework/blob/f566ac293e4e6bd80c4e9b062b5699f04eac41f4/LICENSE)，Copyright (c) 2026 ego-browser-benchmark-framework contributors

本包依据上游 MIT 许可证复制任务提示词，并保留来源提交与署名。它不表示与上游存在关联，也不表示
获得认证或背书。
