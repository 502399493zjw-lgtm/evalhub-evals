# 输入格式

参考 `example-submission.json`。顶层只能包含 `participant`、固定为 `1` 的 `trials` 与 `artifact`。participant 只允许带完整日期的 `model` 和可选 `config`，不携带 harness。

证据元数据需要描述如何复现，而不是嵌入大文件；截图、世界存档和日志应以安全相对路径引用。
