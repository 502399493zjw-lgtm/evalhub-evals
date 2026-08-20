# Tasks 与来源快照

完整 97 题已逐字嵌入 `../eval.yaml`，来源为 tau2-bench `fc0055dc4e0a316c3f83133267fbd6faaa770992` 的 `data/tau2/domains/banking_knowledge/tasks.json`。题面是 user simulator 的完整场景指令；被测 Agent 通过动态对话、policy、知识检索和工具环境工作。EvalHub 稳定任务 ID 将上游 `task_001` 确定性映射为 `task-001`，任务标签保留上游 ID。

- `example-submission.json`：与上游文本运行单体 `results.json` 相同的关键结构，含 97×5 条确定性合成模拟；用于打包器格式测试，不是运行结果或 baseline。
- `official-aa-source-snapshot.json`：2026-08-20 官方页面 Next 数据的 29 行规范化快照，保留排名、来源标签、未舍入主分、token、cache、价格与速度字段，以及页面展示所用派生公式；SHA-256 为 `d52b0e9a2164ae79c8fcc5df1abc47cf4b7886113baba8ce317e8c6c8b9d8f3d`。
