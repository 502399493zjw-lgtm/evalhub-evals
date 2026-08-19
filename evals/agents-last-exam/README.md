# Agents’ Last Exam（ALE）

这是 [Agents’ Last Exam](https://agents-last-exam.org/) 的 EvalHub 外部工作流定义。评测实际在 ALE 提供的 VM、任务包与运行器中完成；本目录不复制任务数据、Docker 镜像、评测器或解答，也不会在 EvalHub 中启动 ALE。

评测协议固定到上游提交 [`75a3f866535946b67f9a57e4f158eb30ad50be8a`](https://github.com/rdi-berkeley/agents-last-exam/tree/75a3f866535946b67f9a57e4f158eb30ad50be8a)。计分范围为该提交的 [`selected_tasks/full/overall.txt`](https://github.com/rdi-berkeley/agents-last-exam/blob/75a3f866535946b67f9a57e4f158eb30ad50be8a/selected_tasks/full/overall.txt) 所列 152 个任务、各任务默认 variant `0`。

详情页的可读说明、完整官网快照和五道完整双语案例在 [`eval.yaml`](eval.yaml) 的 `detail_profile.markdown` 中；外部运行结果清单格式见 [`tasks/README.md`](tasks/README.md)。

## 本地打包

外部 ALE 运行完成后，使用本目录的轻量转换器将**已存在的** 152 个 `eval_result.json` 结果摘要和 `run.json` 摘要整理成 EvalHub 结果：

```text
node evals/agents-last-exam/pack-to-result.mjs <manifest.json> --out agents-last-exam-result.json
```

该命令不调用 `ale_run`、不构建镜像、不下载数据，也不读取或执行任务目录；它只做清单完整性、任务 ID、分数和哈希的验证，并计算平均分。`tasks/example-submission.json` 仅展示字段结构，不能作为真实成绩或基线。

## 上游运行资料与边界

- **源码与版本**：使用 [rdi-berkeley/agents-last-exam](https://github.com/rdi-berkeley/agents-last-exam) 的固定 commit [`75a3f866535946b67f9a57e4f158eb30ad50be8a`](https://github.com/rdi-berkeley/agents-last-exam/tree/75a3f866535946b67f9a57e4f158eb30ad50be8a)。上游 README 的 [Running the benchmark](https://github.com/rdi-berkeley/agents-last-exam/blob/75a3f866535946b67f9a57e4f158eb30ad50be8a/README.md#running-the-benchmark) 与官网运行文档是安装、配置和调用的唯一权威说明。
- **调用边界**：先在提交者自行管理的上游 ALE 环境中，以该 commit 的 experiment YAML、agent harness 和 full task profile 完成运行；上游完成后，从每题最终 `eval_result.json` 与对应 `run.json` 抄录 score、run_id 和原始字节 SHA-256 到 152 项清单，再调用本目录转换器。
- **输入与输出**：上游输入是 full profile 中每个任务被阶段化的文件、默认 variant 与 agent/harness 配置；上游输出至少包括任务的 `eval_result.json` 与 `run.json`。EvalHub 输入是无任务资产的 JSON 清单，输出是 result-v1 JSON；不上传输入数据、任务产物、模型输出或轨迹。
- **资源、网络与权限**：上游 README 列出 Google Cloud VM、AWS（EC2 + S3）和 Alibaba Cloud（ECS + OSS）等运行环境。实际运行可能需要云项目、计算与对象存储权限、镜像／依赖获取网络以及所选模型或 agent harness 的凭据；具体范围取决于提交者选用的上游配置。EvalHub 转换器不需要这些权限，也不联网。
- **已知限制与验证状态**：本提交没有在 EvalHub 中真实运行 ALE，也不声称已验证可运行或已通过安全检查；官方 publication 只作为可追溯的公开基线。运行前应自行审阅固定版本的来源代码、任务、许可和云／模型凭据边界。

## 许可与归属

上游 README 声明 ALE 软件采用 Apache-2.0、基准数据采用 CC-BY-4.0。本目录仅转录五道公开题面用于文档展示，并保留来源和协议提交；权利与归属以 [上游仓库](https://github.com/rdi-berkeley/agents-last-exam) 的声明为准。
