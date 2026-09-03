# E-CommerceBench

本目录把 QwenLM 官方发布的 E-Commerce Bench 映射为 EvalHub 的外部工作流评测。协议固定到上游 commit `0c5d352f75a6022049561e4407cbcfc494156c5c`：Agent 从 10 万元本金开始，在 365 个模拟日里经营最多四家网店；每个模型运行五个独立 episode，主成绩是五次年末总资产与初始本金之比的平均值。

## 运行边界

上游 runner 需要 Python 3.10+、模型与 NPC 供应商调用凭证、联网、较长运行时间和相应费用。按上游默认配置准备依赖和模型键后，运行路线是：

```bash
python run.py --model <model-key> --max-days 365 --initial-balance 100000 --runs 5
```

模型键、供应商端点和凭证变量以固定 commit 的 `models_config.json`、`.env.example` 与 `run.py` 为准。不要把凭证写入提交清单。上游会把轨迹、逐日余额、消息和分析结果写入日志目录；提交者从五次真实 episode 中整理 `tasks/example-submission.json` 所示的清单，再交给本目录转换器。

本次 readiness 不调用模型、不运行模拟器，也不验证第三方 API、成本或完整 365 天执行，因此 runtime verification 为 `unverified`。仓库内验证只覆盖元数据、清单边界、确定性换算与 EvalHub 结果 schema。

## 评分映射

上游 `EcommerceToolManager` 在 episode 结束时把银行余额、平台钱包和待结算款相加为 `final_a`，并计算 `final_score = final_a / 100000`。本转换器要求恰好五次 episode，并按同一公式计算：

```text
score = mean(final_assets_cny across 5 episodes) / 100000
```

提前破产的 episode 不会被丢弃；其结束资产仍进入五次平均。`scored_by=author` 表示外部结果只有在评测作者核对固定 commit、五份证据包、模型配置和完整日志后才认可。

## 文件

- `eval.yaml`：协议、题面、完整中文读者页与固定来源。
- `published-results/official-readme-2026-09-02.json`：上游 README 的 18 行官方结果快照；当前模型注册表无法唯一映射的五行通过 `omitted_models` 明示。
- `tasks/example-submission.json`：仅用于结构测试的虚构五次运行。
- `pack-to-result.mjs`：清单校验与确定性结果转换器。
- `sample-result.json`：示例清单转换后的结构样例，不是官方成绩。

## 一手来源

- 仓库：<https://github.com/QwenLM/E-CommerceBench/tree/0c5d352f75a6022049561e4407cbcfc494156c5c>
- 论文：<https://arxiv.org/abs/2608.30730>
- 官方结果快照：<https://github.com/QwenLM/E-CommerceBench/blob/0c5d352f75a6022049561e4407cbcfc494156c5c/README.md>
- 原始题面：<https://github.com/QwenLM/E-CommerceBench/blob/0c5d352f75a6022049561e4407cbcfc494156c5c/agent/prompts.py>
- 评分实现：<https://github.com/QwenLM/E-CommerceBench/blob/0c5d352f75a6022049561e4407cbcfc494156c5c/agent/ecommerce_tool_manager.py>
