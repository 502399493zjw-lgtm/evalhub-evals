# τ³-Banking

本目录把 Sierra Research 的 τ-Knowledge `banking_knowledge` 域接入 EvalHub，并严格采用用户指定的 Artificial Analysis 当前评测方法：上游 v1.0.1、97 题、每题 5 次、`bm25_grep`、最多 200 steps，主分为 485 个 binary reward 的平均值乘 100。

## 固定协议

- 上游：`sierra-research/tau2-bench` commit `fc0055dc4e0a316c3f83133267fbd6faaa770992`（tag `v1.0.1`）
- 任务文件：`data/tau2/domains/banking_knowledge/tasks.json`，SHA-256 `213c7f3e6dc0420b1184ee271e39e38c6ece3c43edfa362db49a560828ebd543`
- 97 个任务、698 份知识文档、text/half-duplex 双 Agent 模拟
- Artificial Analysis 配置：GPT-5.4 Mini medium user simulator、`bm25_grep`、200 steps、5 repeats
- 评分：88 个 DB-state reward + 9 个 ACTION reward；逐次 reward 必须是 0 或 1；`score = sum(reward) / 485 × 100`

上游明确说明 v1.0.1 修正了 `banking_knowledge` grading；早期结果不可与本协议比较。

## 来源台账

| 一手来源 | 本目录采用的事实 | 固定边界 |
| --- | --- | --- |
| [AA 当前方法](https://artificialanalysis.ai/methodology/intelligence-benchmarking) | 97 题、5 repeats、GPT-5.4 Mini medium、`bm25_grep`、200 steps、backend-state/pass@1 | 2026-08-20 读取 |
| [AA τ³-Banking 成绩](https://artificialanalysis.ai/evaluations/tau3-banking) | 页面内 machine-readable Score dataset 的完整 20 行 | HTML SHA-256 `95210a5a…bf35` |
| [上游固定树](https://github.com/sierra-research/tau2-bench/tree/fc0055dc4e0a316c3f83133267fbd6faaa770992) | runner、任务、文档、grader、CLI | v1.0.1 peeled commit |
| [固定任务 JSON](https://github.com/sierra-research/tau2-bench/blob/fc0055dc4e0a316c3f83133267fbd6faaa770992/data/tau2/domains/banking_knowledge/tasks.json) | 97 条完整 user-simulator instructions 与 evaluation criteria | SHA-256 `213c7f3e…d543` |
| [Knowledge README](https://github.com/sierra-research/tau2-bench/blob/fc0055dc4e0a316c3f83133267fbd6faaa770992/src/tau2/knowledge/README.md) | retrieval config 与依赖 | 同一 commit |
| [Evaluation README](https://github.com/sierra-research/tau2-bench/blob/fc0055dc4e0a316c3f83133267fbd6faaa770992/docs/evaluation.md) | DB/ACTION reward 语义 | 同一 commit |
| [MIT License](https://github.com/sierra-research/tau2-bench/blob/fc0055dc4e0a316c3f83133267fbd6faaa770992/LICENSE) | 任务/代码再分发边界 | 同一 commit |

## 外部运行

这不是 EvalHub 服务器内直接执行的轻量 runner。参与者需在自己的受控环境中运行固定上游：

~~~bash
git clone https://github.com/sierra-research/tau2-bench.git
cd tau2-bench
git checkout fc0055dc4e0a316c3f83133267fbd6faaa770992
uv sync --extra knowledge

# 骨架命令；<participant-model> 与供应商参数由实际参赛配置替换。
uv run tau2 run \
  --domain banking_knowledge \
  --agent llm_agent \
  --agent-llm <participant-model> \
  --user-llm <provider-id-for-GPT-5.4-Mini> \
  --user-llm-args '{"reasoning_effort":"medium"}' \
  --retrieval-config bm25_grep \
  --num-trials 5 \
  --max-steps 200
~~~

不要传 `--num-tasks` 或 `--task-ids`；完整协议要求 base split 的全部 97 题。上述命令是上游 CLI 的可核查骨架：Artificial Analysis 没有公开供应商侧 GPT-5.4 Mini 的精确 router ID、所有 fallback 和私有调度细节，因此本目录不伪造这些值。

运行依赖 Python 3.12–3.13、`uv`、参与模型与用户模拟器的 API 凭据、供应商网络访问和足够的 485 次模拟配额。`bm25_grep` 本身是离线检索配置；模型调用仍需网络。任务可能读写模拟数据库并调用用户/Agent 工具。

## 打包输入与调用

把真实运行整理成与 [example-submission.json](tasks/example-submission.json) 相同的 JSON：必须有固定 protocol 字段、97×5 条逐次 reward、每条 trajectory 的 SHA-256，以及整包证据 SHA-256。然后执行：

~~~bash
node /absolute/path/to/evalhub-evals/evals/tau3-banking/pack-to-result.mjs \
  /absolute/path/to/real-submission.json \
  /absolute/path/to/tau3-banking-result.json
~~~

打包器会拒绝不完整 task/trial 集、重复 attempt、错误 commit/config、非二元 reward、无效 SHA-256，以及输入中的任何预计算总分；输出成绩只能由 485 条 reward 推导。

## 验证状态与限制

- 已静态核对固定任务数、reward-basis 分布、检索配置、CLI 参数、打包器输入约束与官方数值来源。
- 本提交没有运行真实模型 API 或 485 次模拟，也没有验证凭据、quota、provider routing、耗时和完整 runtime，所以 **runtime unverified**。
- `sample-result.json` 与 `tasks/example-submission.json` 是合成格式样例，不是 baseline。真实 baseline 只来自 `published-results/official-aa-score-2026-08-20.json`。
- AA 的 5-repeat 结果与 Sierra 官方 leaderboard 的 4-trial 标准赛道不可混用；本目录只发布前者。
