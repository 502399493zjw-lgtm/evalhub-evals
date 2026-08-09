# 葬 AI Bench

葬 AI Bench 的当前题目是 `graph-engineering-v2`：编码 Agent 只拿到 `tasks/graph.json`，需要交付一个离线可用的知识图谱探索器。输入含 649 个节点、1699 条关系、4 类节点与 16 类关系；题目同时验收搜索、筛选、邻接详情、缩放拖拽、重置、最短路径及精确统计。

## 新版来源边界

本投稿按作者要求以本地 `zangai-bench-v2` 的新题为准。一个月前的 [personal-work-benchmark](https://github.com/FrichXi/personal-work-benchmark) 只保留为历史框架链接，不用于定义本次 prompt、graph、scorer 或运行版本。精确题面已内联进 `eval.yaml`，精确图数据放在 `tasks/graph.json`；未内嵌的作者浏览器评分器以源码 sha256、版本和完整权重表锁定。

来源、字段映射、版本和许可边界逐项记录在 `SOURCE-LEDGER.md`。

详情页品牌图使用作者权威的透明文字 Logo，采用 `logo-only` 模式，不叠加模型版本角标，也不做重绘、改色或发光处理。

## 运行协议

每个模型通过 OpenCode 1.17.9 独立运行 10 轮。每轮使用相同题面与图数据，并在干净目录中从零实现网页。完成后，作者用 Playwright 1.61.1 + Chromium 运行评分器 3.1；11 项权重合计 100。失败、超时或无产物的轮次不删除，统一记 0；主分数为十轮分数的算术平均，四舍五入到两位小数。

评分器源码摘要：

```text
6f773714090a5a1da48d15fb493f0d7dd08aa6d5a6b8944988846cee3b115828  score-graph-engineering-v2.cjs
```

评分器在作者运行环境中执行，不在 EvalHub custom runner 沙箱里启动浏览器。`scored_by: author` 表示作者必须检查原始运行目录、浏览器评分报告、统一 harness 和证据摘要后，成绩才可认可。

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

当前 EvalHub 模型注册表能准确映射其中 12 个模型，它们作为一等成绩导入。Claude Opus 5、DeepSeek V4 Flash、GPT-5.6 Luna、ERNIE 5.1 暂无可解析的规范身份，不能冒险绑到相近模型；完整 16 模型最终总榜仍保存在“官方完整总榜”辅助表中，未被删减。所有发布成绩都是作者来源转录，不含 `task_results`、`showcases` 或 `usage`，不声称 EvalHub 复跑。

## 文件

- `eval.yaml`：题面、协议、评分说明和详情页内容
- `tasks/graph.json`：新版固定图数据
- `tasks/example-submission.json`：确定性结构夹具
- `pack-to-result.mjs`：外部运行清单转换器
- `sample-result.json`：夹具转换结果
- `published-results/`：作者当前发布成绩快照
- `SOURCE-LEDGER.md`：一手来源台账与许可边界
