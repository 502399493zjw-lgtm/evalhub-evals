# CEO-Bench（NovaMind 创业模拟）

基于 Princeton CEO-Bench（[官网](https://ceobench.com/) · [论文](https://arxiv.org/abs/2606.18543)）的长周期 agent 经营评测。模型作为 bash agent 经营 NovaMind SaaS 创业公司：初始现金 $1,000,000，通过 `novamind-operation` CLI 做定价、研发、投放、容量与配额决策，按周推进并阅读仪表盘，现金耗尽即破产终止。

## 归档声明（必读）

> **本评测集首批成绩由 2026-07 分析包保留观测重建归档提交，非平台实时跑分。**

- 数据来源：`ceobench_m3_glm52_analysis_pack_20260707`（本地真实运行证据包，含 MiniMax-M3 `run_ea06fe84` 与 GLM-5.2 `run_6ff698f0` 两条 2026-07-06 完成的单次运行，seed 42、default 场景）。
- 每周仪表盘时间线由日志保留观测重建，**不是原始工具日志的逐字引用**；不展示模型原始推理。
- 每个模型仅一次运行，是行为案例研究，**不具统计稳定性**；两次运行均以破产终止。
- 归档运行的本地配置为 3,647 天，与官方发布的 500 天协议不同，**结果不可并入论文协议组**。
- 两次运行推理设置不同（MiniMax-M3 未设置 reasoning_effort；GLM-5.2 为 high）；且原始运行框架缺少 MiniMax-M3 的交错推理数据。
- 上游 API 模型名不带日期（`MiniMax-M3` / `glm-5.2`），归档成绩的模型 ID 日期后缀（`-2026-07-06`）为本地运行日期，不是官方模型快照日期。

## 真实管线（如何提交新成绩）

1. 本地跑 CEO-Bench harness（示例，见官方仓库文档）：

   ```bash
   uv run python -m saas_bench.agents.bash_agent.run_test \
       --model <你的模型> --provider <provider> --seed 42 --days 500 \
       --workspace bash_agent_runs
   ```

2. 把产出的 `run_<id>/` 目录（含 `config.json`、`checkpoint.json`、`logs/`）放到或软链到工作目录下的 `ceobench-run-dir`，然后转换：

   ```bash
   node evals/ceo-bench/pack-to-result.mjs ceobench-run-dir --out ceo-bench-result.json
   ```

   转换器只读运行证据、不调模型、不产生分数（`score` 恒为 `null`，scored_by=author 由作者复核回填）。

3. `evalhub submit ceo-bench-result.json`。

## 判分口径

见 `eval.yaml` 的 `scoring_note`：作者按存活天数与终局经营结果综合评定并回填 0-100 分；`task_results[].score` 记录的是观测存活天数（原始观测，不是最终评分）。

## 数据溯源

| 结果字段 | 来源 |
| --- | --- |
| `run_date` | `logs/tool_results_<id>.jsonl` 首条记录 timestamp（两条运行均为 2026-07-06 UTC） |
| `participant.config.*` | `config.json` 原样字段（model/provider/reasoning_effort/seed/scenario/total_days/run_id/label） |
| `usage.tokens` | `checkpoint.json` 的 `total_input_tokens + total_output_tokens`（推理 token 单列于 detail） |
| `raw_metric` / `task_results[].raw` | 最后一条仪表盘观测（终止日、终局现金、个人订阅用户） |
| showcases 时间线 | `tool_results` 日志中按仪表盘标题解析模拟日、同日保留首次观测的重建序列（MiniMax-M3 39 条 / GLM-5.2 45 条），已对照平台 2026-07 展示快照保留表逐行核验一致 |

证据包与关键文件的 SHA-256 摘要见 `assets/README.md`。
