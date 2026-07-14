# 输入格式

以 `example-answers.json` 为起点。顶层字段只能是 `participant`、`trials`、`answers`；participant 必须使用 `quickjs-wasm@0.32.0` harness，模型 ID 必须以真实 `YYYYMMDD` 或 `YYYY-MM-DD` 日期结尾。`answers` 必须且只能包含 `c1`–`c6` 六个非空源码字符串。

参赛源码仅应定义题目要求的函数，不应依赖任何宿主能力。
