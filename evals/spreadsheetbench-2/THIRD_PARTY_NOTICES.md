# Third-party notices

## SpreadsheetBench 2 task text

`eval.yaml` 中 321 条英文 `prompt` 来自 SpreadsheetBench 2 官方数据集 `KAKA22/SpreadsheetBench-v2` 的固定 Hugging Face 快照 `9dea60025792fbac5928ce9f44812362dccbeecd`；321 条任务均另附由本提交作者制作的完整简体中文 reader translation。详情 Markdown 只展示其中五条确定性案例，但这一展示上限不改变 `eval.yaml` 所含中译的许可与署名边界。

SpreadsheetBench 2 论文 v1 的 Appendix F 明确写明数据集使用 [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/)；本提交因此对任务文字和由其改编的中文翻译采用这一更具体、限制更严格且可归因到论文作者的许可边界。请保留对原作者、论文、官方数据集和本翻译的署名；分发修改版本时遵守 CC BY-SA 4.0 的相同方式共享要求。

官方 Hugging Face card 同时把整个仓库标为 `MIT`，而其归档中没有独立许可文件。该元数据冲突没有被本提交静默消解：证据与采用理由见 `SOURCE_LEDGER.md`。本提交不把 Hugging Face 的 `MIT` 标签解释成覆盖论文对数据集的 CC BY-SA 4.0 声明。

## SpreadsheetBench 2 evaluation code

论文 v1 说评测代码使用 MIT 许可，但官方根仓库在固定 commit `83d415ce87b1d6b8e8eafcc26957f5d13d37210f` 没有根级 `LICENSE`。因此本目录不复制上游评测实现，只提供独立编写的清单校验和结果打包器。上游仓库内 `SWE-agent/LICENSE` 只适用于其嵌入的 SWE-agent 子树，不被视为根项目许可。

## No workbooks or source documents

本目录不含官方 `.xlsx`、参考答案、财务报告或其他原始文档。参与者必须从官方固定快照自行取得运行材料，并遵守其来源和使用条件。
