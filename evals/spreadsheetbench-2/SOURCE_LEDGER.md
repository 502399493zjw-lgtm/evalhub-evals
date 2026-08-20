# Source ledger

检索日期均为 2026-08-20。只用第一方作者来源固定候选边界。

| 证据 | 固定标识 | 在本提交中的用途 |
| --- | --- | --- |
| [官方代码仓库](https://github.com/RUCKBReasoning/SpreadsheetBench-2/tree/83d415ce87b1d6b8e8eafcc26957f5d13d37210f) | commit `83d415ce87b1d6b8e8eafcc26957f5d13d37210f` | 当前运行说明、精确任务评分、Visualization 双输出行为 |
| [论文 v1](https://arxiv.org/abs/2606.29955v1) | arXiv source SHA-256 `47914f0020875aa18d343a4fba1c2ef46ac572625e4cc438ae14e34161d82969` | 321 题构成、论文版八行结果、mean-rubric 定义、数据集 CC BY-SA 4.0 / 代码 MIT 声明 |
| [官方数据集](https://huggingface.co/datasets/KAKA22/SpreadsheetBench-v2/tree/9dea60025792fbac5928ce9f44812362dccbeecd) | commit `9dea60025792fbac5928ce9f44812362dccbeecd`；zip SHA-256 `17147ef9578cd57ce76c9a719d19da7821f3e5cb0d8f776c820f699fdcdb761c` | 321 条任务的顺序、ID、完整 instruction 与外部工作簿路径 |
| [官方 live leaderboard JSON](https://github.com/spreadsheetbench/spreadsheetbench.github.io/blob/c72f46b1eeb898c515d70248cb8d1b721f7a2584/data/leaderboard-v2-full.json) | site commit `c72f46b1eeb898c515d70248cb8d1b721f7a2584`；原始字节 SHA-256 `3f8f720b66003dfbbb43985d8749b31bf25db1b91c2d3f7cc12e5d57a2ed6d8e`；本目录只补末尾换行的规范化快照 SHA-256 `7383446dad579e019ccc1d1feb6fe2e876372c73d1fb867a7461d0438989c8e2` | 2026-08-20 可见的完整十行排行榜及四个分项 |
| [官方主页](https://spreadsheetbench.github.io/) | HTML SHA-256 `f82d3ba7017b09db2c8c2b2fd0b6f2b41ec70a139555c23bc140800b1b15d375` | live 方法正文和 Visualization “above 70” 说明 |

固定数据 zip 中四个 `dataset.json` 的 SHA-256 分别为：

- Debugging：`fb3441c0255a50f9e5e885c9c8dc952b109ba5673f712c181e5d7da7b1c682cc`
- Financial_Model：`4edf2a8dd20384ef9d0fd1719d83ecbdb209b111ddfa9365c4ea0613b80ddf78`
- Template：`e3d2942e1fab23ae0c90ad199d0cb43660027965593de810ff50f9ea67397e61`
- Visualization：`bb4f0a29191d956d04c0b1994a5972f5fe47c2a219a4c3097c0017f423fdbb80`

这些摘要用于逐字核验本目录的 321 个 `prompt` 和稳定顺序；四个 manifest 本身及工作簿均未复制进提交。

## 固定版本边界

论文 v1 表格只有八个模型；live 官方 JSON 后来加入 `arito` 与 `WPS AI`，形成十行。本条目的公开结果以 2026-08-20 读取的 live JSON 为准，不把论文八行与 live 十行混合成同一个来源。所有十行的 Overall 均与 `(Template × 97 + Financial Modeling × 100 + Debugging × 100 + Visualization × 24) ÷ 321` 在来源展示精度下相符。

## Visualization 口径边界

论文把 Visualization 任务分数定义为通过 rubric 条目占比，论文表格称其为 average rubric pass rate。当前脚本同时输出每题 `score = passed / total_expected` 与 `acc = 1 if score > 0.7 else 0`，摘要又同时给出 `all_task_avg_score` 和二值 `accuracy`。live 表中 `arito=83.02`、`WPS AI=57.02` 不可能是 24 个二值任务的整数通过率，但可以是 24 个 rubric-pass-rate 的均值；且 live Overall 正好按这些数值和 97/100/100/24 加权。因此本协议把 mean-rubric 选为可比主分，把 `>0.7` 二值 ACC 明确排除为诊断字段。

## 许可冲突边界

论文 Appendix F 的对象和许可最具体：dataset 为 CC BY-SA 4.0、evaluation code 为 MIT。HF card 只提供 `license: mit` 元数据，其 README SHA-256 为 `ed37494e71e9db5ef8cf5357a5fc97937c0d065185d0f11fb6b5fc0a515bde8b`，数据 zip 内无许可文件；官方根代码仓库也无根级 `LICENSE`。本提交按更具体的论文声明，以 CC BY-SA 4.0 处理必要的任务文字和翻译；不复制上游根代码，也不声称缺失许可文件的问题已经被 MIT 标签补足。若上游之后发布明确的根级许可文件，应以新证据重新审阅，而不是回写改变本固定候选的历史边界。
