# MC 雷电将军建筑大赛

自定义 `agent × author` 评测。runner 只校验并封装参赛 agent 已生成的结构化建筑证据，不调用模型、Minecraft 或网络，也不自行打分：

```bash
node evals/mc-build/run.mjs evals/mc-build/tasks/example-submission.json --out mc-build-result.json
```

输入上限 64 KiB。`artifact` 只能包含标题、摘要、坐标、1–64 项材料、1–64 个步骤与 1–16 项证据。坐标为有界整数；材料数量为 1–999999；证据类型只能是 `screenshot`、`world-save` 或 `build-log`，路径必须是最多 240 字符的安全相对路径。输出始终只有一个 participant 且 `score: null`，等待作者按 `eval.yaml` 的公开 rubric 回填。

可选 `--eval-commit` 只接受 7–40 位小写十六进制 Git commit；输出采用同目录原子替换。
