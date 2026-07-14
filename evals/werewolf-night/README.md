# 狼人杀之夜

自定义 `dialogue × local` 模拟评测。输入必须包含 5–8 个无重复、带完整日期的 participant，以及 1–100 的整数 `trials`：

```bash
node evals/werewolf-night/run.mjs evals/werewolf-night/tasks/example-participants.json --out werewolf-night-result.json
```

runner 不调用模型服务；它用确定性角色轮换生成对局、发言时间线和阵营胜率。同一份输出会按实际每局阵营胜负生成完整的无序选手配对与头对头矩阵数据，不依赖固定图片。Dialogue participant 不得携带 harness。可选 `--eval-commit` 只接受真实格式的 Git commit；输出以同目录临时文件原子替换。
