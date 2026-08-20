# τ³-Banking

本目录将 Sierra Research 的 τ-Knowledge `banking_knowledge` 域接入 EvalHub，并采用 Artificial Analysis 当前公开方法：上游 v1.0.1、97 题、每题 5 次、`bm25_grep`、最多 200 steps，主分为 485 个 binary reward 的平均值乘 100。

## 固定协议

- 上游：`sierra-research/tau2-bench` commit `fc0055dc4e0a316c3f83133267fbd6faaa770992`（tag `v1.0.1`）
- 任务文件：`data/tau2/domains/banking_knowledge/tasks.json`，SHA-256 `213c7f3e6dc0420b1184ee271e39e38c6ece3c43edfa362db49a560828ebd543`
- 范围：97 个任务、698 份知识文档、text/half-duplex 双 Agent 模拟
- Artificial Analysis 配置：GPT-5.4 Mini medium 用户模拟器、`bm25_grep`、200 steps、5 repeats
- 评分：88 个 DB-state reward + 9 个 ACTION reward；逐次 reward 必须为 0 或 1；`score = sum(reward) / 485 × 100`

上游说明 v1.0.1 修正了 `banking_knowledge` grading；更早版本的结果不属于本提交边界。

## 来源台账

| 一手来源 | 本目录采用的事实 | 固定边界 |
| --- | --- | --- |
| [AA 当前方法](https://artificialanalysis.ai/methodology/intelligence-benchmarking) | 97 题、5 repeats、GPT-5.4 Mini medium、`bm25_grep`、200 steps、binary Pass@1 | 2026-08-20 读取 |
| [AA τ³-Banking 成绩](https://artificialanalysis.ai/evaluations/tau3-banking) | Next `initialModels` 中全部 29 个非空 `tauBanking` 参与者，以及 Token Usage、Cost、Speed 所需字段 | 规范化快照 `tasks/official-aa-source-snapshot.json`；SHA-256 `d52b0e9a2164ae79c8fcc5df1abc47cf4b7886113baba8ce317e8c6c8b9d8f3d` |
| [上游固定树](https://github.com/sierra-research/tau2-bench/tree/fc0055dc4e0a316c3f83133267fbd6faaa770992) | runner、任务、文档、grader、CLI | v1.0.1 peeled commit |
| [固定任务 JSON](https://github.com/sierra-research/tau2-bench/blob/fc0055dc4e0a316c3f83133267fbd6faaa770992/data/tau2/domains/banking_knowledge/tasks.json) | 97 条完整 user-simulator instructions 与 evaluation criteria | SHA-256 `213c7f3e6dc0420b1184ee271e39e38c6ece3c43edfa362db49a560828ebd543` |
| [Knowledge README](https://github.com/sierra-research/tau2-bench/blob/fc0055dc4e0a316c3f83133267fbd6faaa770992/src/tau2/knowledge/README.md) | 检索配置与依赖 | 同一 commit |
| [Evaluation README](https://github.com/sierra-research/tau2-bench/blob/fc0055dc4e0a316c3f83133267fbd6faaa770992/docs/evaluation.md) | DB/ACTION reward 语义 | 同一 commit |
| [MIT License](https://github.com/sierra-research/tau2-bench/blob/fc0055dc4e0a316c3f83133267fbd6faaa770992/LICENSE) | 任务与代码再分发边界 | 同一 commit |

官方页面是动态页面，页面内 JSON-LD 在采集时仍只有较早的 20 行；本目录采用与可见“29 of 170 models”一致的 Next 数据，并把所用字段规范化保存为仓库内快照。页面资源表的派生公式与原始数值均记录在该快照中。

## 外部运行

本评测不是 EvalHub 服务端直接执行的轻量 runner。参与者需在自己的受控环境中运行固定上游：

~~~bash
git clone https://github.com/sierra-research/tau2-bench.git
cd tau2-bench
git checkout fc0055dc4e0a316c3f83133267fbd6faaa770992
uv sync --extra knowledge

# 骨架命令；<participant-model> 与供应商参数必须换成真实参赛配置。
uv run tau2 run \
  --domain banking_knowledge \
  --agent llm_agent \
  --agent-llm <participant-model> \
  --user-llm <provider-id-for-GPT-5.4-Mini> \
  --user-llm-args '{"reasoning_effort":"medium"}' \
  --retrieval-config bm25_grep \
  --num-trials 5 \
  --max-steps 200 \
  --save-to tau3-banking-aa-v1-0-1
~~~

不要传 `--num-tasks` 或 `--task-ids`；完整协议要求 base split 的全部 97 题。Artificial Analysis 未公开供应商侧 GPT-5.4 Mini 的精确 router ID、全部 fallback 或私有调度细节，因此这里不伪造这些值。

文本运行会把完整结果保存为单体 `data/simulations/tau3-banking-aa-v1-0-1/results.json`。该 JSON 顶层包含 `info`、`tasks` 与 `simulations`；485 条模拟都位于 `simulations[]`，并不是 485 个单独文件。

运行依赖 Python 3.12–3.13、`uv`、参与模型与用户模拟器的 API 凭据、供应商网络访问和足够的 485 次模拟配额；打包需要 Node.js 22 或更高版本。`bm25_grep` 知识检索本身可离线执行，但模型调用仍需网络。API key、token 和其他秘密只能放在运行环境或供应商凭据存储中，不得写入公开结果。

## 打包真实上游结果

从 `evalhub-evals` 仓库根目录执行：

~~~bash
node evals/tau3-banking/pack-to-result.mjs \
  /absolute/path/to/tau2-bench/data/simulations/tau3-banking-aa-v1-0-1/results.json \
  --out /absolute/path/to/tau3-banking-result.json
~~~

命令只接收一个真实上游 `results.json` 作为输入，并把 EvalHub 结果写入 `--out` 指定的不同路径。若输出已存在，打包器会拒绝覆盖。

打包器执行以下确定性检查：

1. 固定 `info.git_commit`、`num_trials=5`、`max_steps=200`、`banking_knowledge`、`bm25_grep`、检索参数与完整 banking policy；agent/user implementation 也必须与固定方法一致。
2. 用户模拟器身份必须精确解析为 GPT-5.4 Mini，且 `reasoning_effort=medium`；参与模型必须解析到 EvalHub registry 中的 canonical ID，其完整 `llm_args` 会保留在 participant config。
3. `tasks[]` 必须包含固定顺序的 97 道任务；打包器会对用户场景、初始状态、评分条件、必需文档和用户工具做语义哈希校验，拒绝被替换的任务树。
4. `simulations[]` 必须恰有 485 个完整 SimulationRun，覆盖固定 97 个上游 task ID 与每题 trial `0..4`；ID、时间戳、耗时、终止原因、消息数组和二元 reward 均为必填并受校验。
5. 每个模拟对象先按递归键排序的稳定 JSON 规范化，再计算 SHA-256；按 `task_id#trial` 排序后的 485 行哈希清单产生整包 `evidence_sha256`。原始单体输入字节另计算 `source_results_sha256`，总分只由 485 个 reward 推导。

`tasks/example-submission.json` 是 485 行的确定性合成格式样例，可用来检查打包器，但不是运行结果或 baseline。`sample-result.json` 只展示 EvalHub 结果 schema。真实官方 baseline 仅来自 `published-results/official-aa-score-2026-08-20.json`。

## 验证状态与限制

- 已静态核对任务数、reward-basis 分布、固定来源、上游结果结构、CLI 参数与打包器输入约束。
- 已用合成的 97×5 单体 `results.json` 通过打包器正向测试，并对错误 commit、任务树、policy、agent/user 身份、模型 registry、缺失核心字段、缺失行、重复 trial 和非二元 reward 做拒绝测试。
- 本提交没有运行真实模型 API 或 485 次完整模拟，也没有验证供应商凭据、quota、routing、耗时和端到端 runtime，因此 runtime 为 **unverified**。
- AA 的 5-repeat 结果与 Sierra 官方排行榜的 4-trial 标准赛道不可混用；本目录只发布前者。
