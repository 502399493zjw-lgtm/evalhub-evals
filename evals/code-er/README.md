# 代码急诊室

自定义 `agent × local` 评测。输入是一个 JSON 对象，包含一个带完整日期的 agent 身份、固定为 `1` 的 `trials`，以及 `c1` 到 `c6` 六段 JavaScript 函数源码：

```bash
node evals/code-er/run.mjs evals/code-er/tasks/example-answers.json --out code-er-result.json
```

每段源码都在全新的 QuickJS/WASM runtime 与 context 中执行。runner 不向参赛代码注册任何宿主函数，也不暴露 Node、`process`、环境变量、文件系统、网络、模块加载或子进程。可信断言闭包会在参赛源码运行前捕获所需内建函数；参赛返回值不会被序列化到宿主，只允许固定的评分 sentinel 穿过边界。每题有 16 MiB heap、512 KiB stack、150 ms 中断期限、64 KiB 源码限制，以及 32 层/4096 节点的结构比较上限。断言失败、异常、语法错误、超时、过深或过大的返回结构只让该题得 0 分，仍会写出合法结果；输入、runner 初始化或结果格式错误则非零退出且不触碰输出。

`--eval-commit` 可选，仅接受 7–40 位小写十六进制 Git commit。输出先写同目录临时文件，再原子替换目标。
