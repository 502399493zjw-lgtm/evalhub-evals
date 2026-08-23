# ReplyBench(代发回复可发送性)

评的不是「写得好不好」,是「敢不敢一字不改直接发出去」。17 道冻结题(IM 12/邮件 3/X 1/Reddit 1;中文 11/英文 6),失败模式全部源自真实产品线上反馈;主指标 **sendable**:全部 critical 判分项通过才算可直接发送,挂一项即 0。

## 计分口径

- 题级分数 = 4 次采样中可发送的比例;总分 = 17 题宏平均 × 100(0–100 分)。
- 判分:确定性检查(15 项)本地判;语义项(74 项)由双裁判(Claude Sonnet 5 + GPT-5.5)独立判定取 **AND**,分歧记 disputed 并按不通过计 —— 主分是**保守安全下界**,不是乐观估计。
- 评分器校准:35/35 正反哨兵 + 确定性回归 + 第三裁判复核;题面与评分标准在正式跑批前冻结。

## 本地怎么跑(custom / external_workflow)

1. clone 上游仓库并按其 README 配置公开端点 key(全部走环境变量,无任何凭证入库):https://github.com/Begin5257/replybench
2. `node run.mjs && node judge.mjs && node aggregate.mjs` 得 `report/summary.json`(约 68 次生成 + 双裁判判分,生成侧参考成本 <$1/模型,判分侧约 $4-5/模型)。
3. 按 `tasks/README.md` 组装提交清单,`node evals/replybench/pack-to-result.mjs <submission.json> --out replybench-result.json`。

转换器无网络、无密钥、确定性;复跑走公开端点属重新实验,与正式榜不自动可比(serving 配置与时点可能不同;Kimi K3 温度为 provider 硬限 1.0)。

## 来源与授权边界

- 上游仓库、正式榜站点与本条目由同一作者发布;`published-results/` 是上游作者发表值(340/340 正式 4-run)的转录,**不代表 EvalHub 独立复跑**。
- 题面均为重新合成;3 题使用作者本人提供的风格档案与合作条款(作者知情同意公开),其余人名/公司/金额为虚构剧情;来源工单只保留编号、不含原文。
- `sample-result.json` 只是结果信封的结构示例(合成 participant),不是任何模型的真实成绩。

## 目录

```
eval.yaml                 评测定义(17 题逐字题面 + 展示案例中译)
pack-to-result.mjs        提交清单 -> 结果信封 转换器
tasks/                    提交清单格式说明 + 文档示例
published-results/        正式榜 5 模型成绩转录(upstream_author_publication)
sample-result.json        结果信封结构示例(非成绩)
assets/                   (无二进制资产,说明见内)
```
