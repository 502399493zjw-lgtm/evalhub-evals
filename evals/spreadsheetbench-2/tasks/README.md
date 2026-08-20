# External-workflow input

`example-submission.json` 是结构性 fixture：它使用已注册的示例模型身份并给出完整 321 条合成零分，不代表任何官方或真实运行。生产提交必须保持相同的字段、任务顺序和固定证据标识，并用真实 evaluator 逐题输出替换 fixture。

每个 `task_results` 元素包含固定 `task_id`、`category`、`status` 与 0–1 `score`。`status` 只能是 `success`、`failed`、`timeout` 或 `missing`；后三者的 score 必须为 0。非可视化 `success` 分数只能是 0 或 1；Visualization 的 `success` 分数是 rubric pass rate，可取 0–1 内任意有限值。不要提交当前 Visualization 脚本的二值 `acc` 作为主分。

`artifact_sha256` 是聚合原始 grader 清单或等价不可变证据的 SHA-256。打包器检查格式但不能证明该摘要对应一次真实运行；作者审核仍需访问相应外部 artifact。
