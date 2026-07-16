# tasks

本评测只有一个任务 `novamind-default-seed42`（完整任务描述见 `../eval.yaml`）：以 bash agent 身份经营 NovaMind SaaS 创业模拟（seed 42、default 场景、初始现金 $1,000,000），存活并最大化经营成果。

## 运行目录约定

`eval.yaml` 的 `command_template` 期望工作目录下存在 `ceobench-run-dir`——一个 CEO-Bench harness 产出的运行目录（或指向它的软链），至少包含：

- `config.json`：运行配置（model/provider/reasoning_effort/seed/scenario/total_days/run_id/label）
- `checkpoint.json`：最终检查点（day、轮次与 token 计数）
- `logs/tool_results_<id>.jsonl`：工具结果日志（转换器从中重建每周仪表盘观测）

转换器 `../pack-to-result.mjs` 不调用模型、不产生分数，只把上述证据重建为 result JSON。
