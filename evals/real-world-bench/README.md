# Real World Bench（真实网站长流程浏览器任务）

Real World Bench 用 31 个浏览器任务评测 Agent 能否在真实网站和一个确定性本地站点上持续完成长流程工作。任务覆盖信息检索与交叉核对、筛选排序、表单草拟、计算器、跨站比较、可视化创作、状态型游戏和限时交互；每题拆成 3–6 个可独立核验的 rubric，以保留部分完成信号。

本投稿固定公开来源仓库 [v0.1.0-beta.1](https://github.com/citrolabs/ego-browser-benchmark-framework/releases/tag/v0.1.0-beta.1) 的 commit `d005652fb082529f8426d09d234acbf57923c8d9`，包含 31 个稳定 task ID 和 154 个 rubric。唯一排名分数是完整运行中所有 rubric 的微平均通过率，范围 0–100，越高越好。

## 评测对象与固定环境

参赛对象是完整浏览器 Agent 系统。为了遵守来源仓库的受控模型比较边界，本协议固定：

- harness：`ego-browser-benchmark-framework` `v0.1.0-beta.1`；
- Stage A provider：`pi`；model provider：`openai`；browser tool：`ego-browser`；browser tool mode：`off`；reasoning effort：`medium`；
- 数据集、附件、本地站点、Judge、运行时限、并发和重试规则均固定；
- `participant.model` 是主要变量；`browser_tool_version` 记录实际运行版本，并在一次比较中保持不变。

账号、Cookie、API key、临时签名 URL 和其它秘密不得进入结果、证据索引或本目录。五题需要登录态，但评测不分发凭证；运行者须拥有合法访问权限并遵守第三方站点条款。

## 固定协议

协议全文见 [`tasks/protocol.json`](tasks/protocol.json)。revision 1 固定：

1. 数据集 SHA-256：`f8349e0c19ae55911f710e0690f31e4067dd18488496a69ca0696cb3a1f6d73a`。
2. 31 题各运行一次；并发为 1；单题墙钟上限 600 秒。
3. provider error、异常 session stop 或空输出最多重试 2 次。负面结果、用满预算或未满足 rubric 不因得分低而重跑。
4. 每个 rubric 由 Pi agent-mode Judge 独立判分；固定模型 `openai/gpt-5.6-terra`、medium thinking、全部去重截图。
5. 来源报告可将 Judge error 任务从部分分母中排除；为保证 EvalHub 排名分母固定，离线打包器只接受 31 题和 154 个 rubric 全部完成判定的结果。

动态日期任务以各 task 的开始时间和题面指定时区为准。Judge confidence 只供审计，不进入分数。

## 附件任务与本地站点

两个非文本资源由 [`tasks/resources.json`](tasks/resources.json) 固定。它们保留在公开来源仓库，而不是复制进 EvalHub：

- `rwb-openai-careers-apply-01` 使用 [`resume-cloud-infra.pdf`](https://raw.githubusercontent.com/citrolabs/ego-browser-benchmark-framework/d005652fb082529f8426d09d234acbf57923c8d9/data/attachments/resume-cloud-infra.pdf)，大小 69759 bytes，SHA-256 为 `297009a5a66a31286c6d853e4e44769fe92d047808cce5a05311c756525b91a5`。PDF 内的 Application Notes 是有意保留的 prompt-injection 探针，不能清洗、重排或重新导出；运行前按声明文件名交付给该 task。HTML 版本只是作者来源，不交给 Agent。
- `rwb-lumen-ticket-rush-01` 使用来源 release 的完整 [`benchmark_sites`](https://github.com/citrolabs/ego-browser-benchmark-framework/tree/d005652fb082529f8426d09d234acbf57923c8d9/benchmark_sites) 树，共 22 个固定文件，清单指纹为 `fd16d94a12146cfba26b476e02f591a1218c5dd0d643ab7e78ff1f7ebf83d2bb`。在 `benchmark_sites` 中执行来源项目声明的安装、状态测试和 `npm run dev:harness`，默认服务地址为 `http://127.0.0.1:4374/ticket-rush`。

来源站点 README 把等待描述成两分钟，但发布版 task rubric 和 `SALE_DELAY_MS=180000` 的可执行代码都定义为三分钟等待，随后是两秒 claim window。本评测以固定任务与代码为准，并在来源台账中保留这项不一致。

附件缺失或 hash 不符、站点源码指纹不符、站点未启动，都属于运行 preflight 失败，不能伪装成 Agent 的 0 分任务。

## 计分

每个 rubric 是二元值：满足为 1，不满足为 0。

~~~text
task score             = passed rubrics for the task / total rubrics for the task
main score             = sum(passed rubrics) / 154 * 100
perfect task rate      = tasks with every rubric passed / 31 * 100
trajectory efficiency = mean(task score / completed agent turns) * 100
~~~

唯一用于排名的 `score` 是 Rubric Avg，按来源报告代码保留 2 位小数。`supplementary_views` 确定性展示总体及 low / medium / high 的 Rubric Avg、Perfect、平均 Agent turns 和 Trajectory Efficiency；这些值不参与排序。没有真实运行输入时不生成曲线、模型比较、趋势点或官方成绩。

## 外部工作流与结果转换

网页执行和 LLM Judge 不在 EvalHub 的锁定容器内运行。参赛者先用固定来源 release 完成 31 题并保存可审计证据，再让离线打包器检查声明并生成 EvalHub 结果：

~~~bash
evalhub fetch real-world-bench

evalhub pack real-world-bench \
  --input /absolute/path/to/real-world-bench-submission.json \
  --out /absolute/path/to/real-world-bench-result.json

evalhub validate /absolute/path/to/real-world-bench-result.json
evalhub submit /absolute/path/to/real-world-bench-result.json
~~~

打包器只读取显式 `{input}`，不联网、不启动子进程、不调用模型服务，也不读取环境变量。它验证：

- 固定来源 commit、协议、数据集与资源指纹；
- 固定 harness/provider/browser/reasoning/Judge 配置；
- 31 个 task 按数据集顺序完整出现，每题尝试次数为 1–3，最终计分尝试不超过 600 秒；
- 每题全部 rubric ID 的布尔判定、confidence、reasoning 与固定 Judge model；
- run 与 task 时间窗、公开无凭证 HTTPS 证据索引和唯一 SHA-256；
- 主分数、逐题分数和辅助指标的确定性计算；
- 最终文件同时通过共享 Result schema 和本评测上下文校验。

打包器不能证明 URL 后的 artifact、模型身份、浏览器轨迹或 Judge reasoning 真实可信。因此 `scored_by: author`：每次提交已含数值成绩，但仍须评测作者核对证据、任务时限、来源指纹、登录与 CAPTCHA 状态、逐 rubric 原始依据、Judge provenance 和 participant identity 后才认可。

## 证据与容错边界

每个 task 的证据索引应回溯到最终 task record、attempt provenance、Agent session 和最终回答、逐 rubric Judge JSON、截图与结构树、起止时间、步数及站点拦截状态。证据不得含凭证或未获授权的第三方数据。

- 页面改版、下线、登录墙、CAPTCHA 与反自动化可能使任务失准。审计时必须区分站点阻断、provider/Judge 基础设施错误与 Agent 能力失败。
- 负面 rubric 判定是有效得分；缺失 Judge 判定、Judge error、超时或资源 preflight 失败会让整份 EvalHub 输入无效，不会被填成 0 后进入排行榜。
- 任务主要使用英文和美国网站，且混合 live site 与本地站点，不能把成绩外推为所有语言、地区或桌面应用的通用能力。
- 本评测继承 Odysseys 的 rubric 与效率方法，但不是其 200 题数据集，也没有把 Odysseys 榜单成绩当成 Real World Bench 基线。

## 数据、许可与归属

任务、附件和本地站点来自 [`citrolabs/ego-browser-benchmark-framework`](https://github.com/citrolabs/ego-browser-benchmark-framework/tree/d005652fb082529f8426d09d234acbf57923c8d9) 的固定公开 release。来源仓库采用 MIT License；其数据说明明确排除若干外部数据集与切片，但未排除 `real_world_bench.json`。本目录保留相同的 [`LICENSE.txt`](LICENSE.txt) 与署名通知。

MIT 许可证覆盖来源项目创作的评测快照、附件和站点代码，不授予第三方网站内容、账号数据、运行时抓取结果或他人证据包的权利。EvalHub 页面与打包器不代表 Citro Labs、任务涉及网站、Odysseys 作者或 ego lite 对本投稿或任何成绩的认证、合作或背书。

逐项来源、事实映射、文件哈希与许可边界见 [`tasks/source-ledger.json`](tasks/source-ledger.json)。本评测没有来源公开、可复核的官方或可信基线，因此 `baseline_policy: optional`，不包含 `published-results/`。

## 合成结构示例

[`tasks/example-submission.json`](tasks/example-submission.json) 和 [`sample-result.json`](sample-result.json) 是 runner 隔离测试所需的确定性结构示例。它们使用固定来源任务定义的真实 URL 与内容哈希，但所有 rubric 均显式标为未执行；没有浏览器运行、Judge 调用、模型输出或执行轨迹，0 分也不是模型成绩、官方基线或 EvalHub 复跑结果。
