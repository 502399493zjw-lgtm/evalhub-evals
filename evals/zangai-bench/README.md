# 葬 AI Bench

葬 AI Bench 的当前题目是 `graph-engineering-v2`：编码 Agent 只拿到 `tasks/graph.json`，需要交付一个离线可用的知识图谱探索器。输入含 649 个节点、1699 条关系、4 类节点与 16 类关系；题目同时验收搜索、筛选、邻接详情、缩放拖拽、重置、最短路径及精确统计。

> **外部工作流边界：** EvalHub 包包含当前题面、完整 graph、摘要与 pack 转换器；完整的 Playwright 评分器 3.1、runner、配置模板和无付费回归测试已经发布到 [葬AI Bench 当前公开仓库](https://github.com/FrichXi/zangai-bench/tree/v2.0.0)。EvalHub CLI 只负责下载协议和封装外部运行清单，`evalhub run zangai-bench` 不受支持；完整复跑请从 GitHub 仓库按 README 自行准备模型凭据与锁定环境。PR 合并前平台预览应禁用正式 EvalHub 安装指令，避免请求尚不存在的正式 slug。

## 新版来源边界

本投稿以公开仓库 [FrichXi/zangai-bench](https://github.com/FrichXi/zangai-bench) 的 `v2.0.0`（提交 `0d51979655df57984ff18c7d95cbe056c017e918`）为新版协议源。该固定版本公开精确 prompt、graph、Playwright 评分器 3.1、runner 与测试；EvalHub 目录同时内联题面并携带 `tasks/graph.json`，三项核心文件均用 sha256 锁定。一个月前的 `personal-work-benchmark` 仅是历史项目，不定义本次协议。

来源、字段映射、版本和许可边界逐项记录在 `SOURCE-LEDGER.md`。

作者权威透明 Logo 位于 `https://libtv.md/assets/logo-zangai-text.png`。它只用于平台封面或品牌位，不属于评测证据，因此不得写进 `detail_profile.figures`、不得显示在“原始图表”模块，也不得叠加模型版本角标、重绘、改色或发光。当前 EvalHub 定义没有投稿方可写的封面字段，平台若为 `zangai-bench` 配置专用机台封面，应在应用的 slug 封面映射中引用该权威 Logo，并使用 `contain` 保持完整比例。

## 运行协议

每个模型通过 OpenCode 1.17.9 独立运行 10 轮。每轮使用相同题面与图数据，并在干净目录中从零实现网页。完成后，作者用 Playwright 1.61.1 + Chromium 运行评分器 3.1；11 项权重合计 100。失败、超时或无产物的轮次不删除，统一记 0；主分数为十轮分数的算术平均，四舍五入到两位小数。

评分器源码摘要：

```text
6f773714090a5a1da48d15fb493f0d7dd08aa6d5a6b8944988846cee3b115828  score-graph-engineering-v2.cjs
```

评分器源码已在公开仓库发布，但仍在作者或复跑者自行准备的外部环境中执行，不在 EvalHub custom runner 沙箱里启动浏览器。`scored_by: author` 表示进入懂模帝正式榜单的成绩仍须由作者检查原始运行目录、浏览器评分报告、统一 harness 和证据摘要后才可认可。

## 提交与转换

外部运行完成后，把十轮成绩整理成清单：

```text
node evals/zangai-bench/pack-to-result.mjs <submission.json> --out <result.json>
```

转换器不联网、不运行模型、不启动浏览器，只做有界输入验证和确定性封装。它固定接受以下协议：

- `manifest_version: 1`、`eval_id: zangai-bench`、`protocol_revision: 1`
- 固定 prompt、graph、scorer 三个 sha256 与 OpenCode / Playwright / scorer 版本
- 真实日历日期和含 `model`、`harness`、`harness_version` 的参赛身份
- 恰好 10 个互不重复的轮次，编号 1–10
- 每轮状态为 `scored`、`failed`、`timeout` 或 `missing`
- `scored` 轮必须给 0–100 分；其他状态的分数必须为 0
- 每轮附 64 位小写十六进制证据包摘要

输入上限 512 KiB，未知字段、缺轮、重复轮次、版本漂移、协议摘要不匹配、非法分数或伪造的非零失败轮都会被拒绝。`tasks/example-submission.json` 和 `sample-result.json` 只用于演示结构，不是官方成绩，也不是 EvalHub 独立复跑。

## 官方成绩快照

`published-results/official-web4-graph-v2-2026-08-04.json` 转录作者在 [当前榜单](https://funeralai.cc/test/) 发布的 `web4-graph-v2-leaderboard-20260804-v2`。只保留这个最终 release 的主分数、中位数、平均耗时、调用数、成本与性价比；不展示单轮明细，也不混入旧批次或中间结果。成本与性价比不进入主排名。

当前 EvalHub 模型注册表能准确映射其中 12 个模型，它们作为一等成绩导入，并各自只展示一行最终汇总，不重复嵌入整张总表。Claude Opus 5、DeepSeek V4 Flash、GPT-5.6 Luna、ERNIE 5.1 暂无可解析的规范身份，不能冒险绑到相近模型；这 4 条的最终汇总集中保存在“待登记模型”辅助表中，因此完整 16 模型数据没有被删减。所有发布成绩都是作者来源转录，不含 `task_results`、`showcases` 或 `usage`，不声称 EvalHub 复跑。

## 文件

- `eval.yaml`：题面、协议、评分说明和详情页内容
- `tasks/graph.json`：新版固定图数据
- `tasks/example-submission.json`：确定性结构夹具
- `pack-to-result.mjs`：外部运行清单转换器
- `sample-result.json`：夹具转换结果
- `published-results/`：作者当前发布成绩快照
- `SOURCE-LEDGER.md`：一手来源台账与许可边界
