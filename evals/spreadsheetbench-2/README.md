# SpreadsheetBench 2 EvalHub reader

这是 SpreadsheetBench 2 的轻量 EvalHub 候选包。它固定 321 条官方任务、2026-08-20 的十行 live 排行榜、完整四分项和一个确定性 external-workflow 打包器；不附带任何 `.xlsx`、参考答案或原始财务文档。

## 可比协议

- 数据：`KAKA22/SpreadsheetBench-v2@9dea60025792fbac5928ce9f44812362dccbeecd`，官方 zip SHA-256 为 `17147ef9578cd57ce76c9a719d19da7821f3e5cb0d8f776c820f699fdcdb761c`。
- 任务：Template 97、Financial Modeling 100、Debugging 100、Visualization 24，共 321 条。EvalHub 固定顺序为 Debugging → Financial Modeling → Template → Visualization；每条 ID 可回溯到上游 ID。
- 代码参考：`RUCKBReasoning/SpreadsheetBench-2@83d415ce87b1d6b8e8eafcc26957f5d13d37210f`。实际 Agent 与官方 evaluator 均在 EvalHub 外部运行。
- 非可视化任务：按上游 evaluator 的完整任务 exact accuracy，只有 regression 与 modification 两部分都完全通过才记 1，否则记 0。
- Visualization：主分采用每题通过 rubric 数 ÷ rubric 总数；当前脚本另算的 `score > 0.7` 二值 ACC 不进入 live 可比主分。
- 总分：321 个任务分数的等权平均 × 100，等价于按 97/100/100/24 对四类百分比分数加权。
- 失败、超时或缺失：必须保留为该题 0 分，不能删除后缩小分母。

## 外部运行

1. 从固定 Hugging Face commit 自行取得数据，核验 zip SHA-256；不要把 golden workbook 暴露给被测 Agent。
2. 按上游 README 建立 Python 3.11 环境，并按任务类型准备 LibreOffice/Docker 或 Windows Excel/WPS COM。模型 API、Visualization 使用的 GLM-4.6V API 以及可能的沙箱服务都需要外网凭据。大批量 `.xlsx` 修改需要充足磁盘、内存和运行时间。
3. 对 297 个非可视化任务运行上游 spreadsheet execution 和 `evaluation/evaluation.py`；对 24 个可视化任务运行当前官方 VLM checklist evaluator，保留每题 mean rubric score。
4. 把每题结果按 `tasks/example-submission.json` 写成 321 行清单。清单必须声明固定数据 commit、zip hash、代码 commit 与 `spreadsheetbench-2-live-mean-rubric-v1` 评分契约。
5. 在仓库根目录运行：

   ```bash
   node evals/spreadsheetbench-2/pack-to-result.mjs \
     evals/spreadsheetbench-2/tasks/example-submission.json \
     --out spreadsheetbench-2-result.json
   ```

打包器只验证结构、固定边界、registry 模型身份和确定性算术，不执行 Excel、调用模型、验证外部 artifact 真伪或代替作者审核。`scored_by: author` 表示公开提交仍须由评测作者核对上游运行材料、grader 输出和证据哈希。

## 目录说明

- `eval.yaml`：Markdown-only 阅读页、321 个稳定任务与 external runner 契约。
- `tasks/official-live-leaderboard.json`：官方 live JSON 的规范化固定副本；只补了仓库要求的末尾换行，原始与规范化 SHA-256 均记在来源台账。
- `published-results/`：能无歧义映射到 EvalHub registry 的机器结果；其余官方行由 `omitted_models` 完整披露。
- `tasks/example-submission.json`：结构性合成 fixture，不是一次真实模型运行。
- `sample-result.json`：fixture 经本目录打包器产生的确定性输出。
- `SOURCE_LEDGER.md` / `THIRD_PARTY_NOTICES.md`：来源、版本、评分漂移和许可边界。
