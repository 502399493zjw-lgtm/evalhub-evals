# Terminal-Bench 2.1（Harbor 终端智能体）

Terminal-Bench 让 Agent 在真实的容器化终端里独立完成端到端任务：编译代码、训练模型、配置服务、处理 TLS 证书、排查系统故障等。每个任务由数据集自带的校验脚本判定成败，Agent 必须自己把活干完，而不是给出建议。

- 项目官网与榜单：<https://www.tbench.ai/leaderboard/terminal-bench/2.1>
- 任务库：<https://www.tbench.ai/tasks>
- 数据集与执行器仓库：<https://github.com/harbor-framework/terminal-bench>
- Harbor 执行框架：<https://github.com/harbor-framework/harbor>
- 论文：Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces（ICLR 2026）<https://openreview.net/forum?id=a7Qa4CcHak>

## 来源与边界

Harbor 与 Terminal-Bench 均以 Apache License 2.0 发布。本目录**没有**复制上游代码、任务、数据集或运行 artifact，只链接并钉死来源；示例 JSON 完全是合成数据。实际运行者须自行遵守 Terminal-Bench、Harbor 以及各任务镜像依赖的当前条款。

EvalHub 页面与本目录的转换器不代表 Terminal-Bench 官方、Harbor 维护者或论文作者的认证、背书或替代实现。EvalHub 不在受限 runner 内运行容器或调用模型；custom runner 只把三次运行声明与证据指纹转换成带数值分数的结果文件。

本评测同时支持两类成绩，且不混淆来源：

- **官网公开成绩**：以 <https://www.tbench.ai/leaderboard/terminal-bench/2.1> 的榜单为分数权威来源，由本评测作者核对固定快照后录入。这只表示「官网公开发布了该成绩」，不表示 EvalHub 独立复跑成功。
- **新的 EvalHub 证据提交**：参赛者按下述固定复现配置提交三次运行证据，仍须本评测作者核对后认可。

## 固定复现配置

每份成绩必须完成三次相互独立的完整运行，且都满足：

1. 使用官方 Harbor 执行器与 `terminal-bench@2.1` 数据集，覆盖该数据集的**全部**任务。
2. 每次运行使用全新的容器环境，互不复用工作副本或缓存结果。
3. 三次运行使用同一模型、同一 agent、同一 harness 版本与同一最高推理强度（声明统一填写 `reasoning_effort: "max"`，作者再核对该 runner 的实际最高档配置）。
4. 不得挑选子集、跳过失败任务、修改或绕过任务自带校验脚本，也不得在失败后单独重试该任务来补分。
5. 三次运行的 `total_tasks` 必须一致，否则分母不可比，转换直接失败。

Harbor 默认使用本地 Docker 执行，也支持切换到云 sandbox 后端横向扩容；`protocol.environment` 记录本次实际使用的后端（例如 `docker`）。上游文档提醒沙箱化 agent 评测通常较慢，横向扩容是加速手段而非硬性要求。

## 计分

分项分数由整数计数唯一确定：`resolved_tasks ÷ total_tasks × 100`。主分 `score` 是三次运行通过率的算术平均（**mean@3**），与官网 accuracy 口径一致，规范到小数点后最多 6 位。

上游把任务错误与超时反映在通过率里，本评测同样计为失败，不做豁免、插值或「最佳重试」替换。缺少任一次运行、计数非法或证据不合规时整份提交不判分，不计算部分总分。

`score_policy: required` 禁止提交 `null` 分数；`baseline_policy: required` 要求每个发布版本至少成功导入一条非空官方基线。

## 官网已发表成绩

[`tasks/terminal-bench-official-results-2026-08-05.json`](tasks/terminal-bench-official-results-2026-08-05.json) 是官网榜单在 2026-08-05 的可机读快照，包含 17 条成绩的 harness、模型、accuracy、置信区间半宽、官网名次与官网标注日期，以及来源页面 SHA-256。

**官网该页面没有公布任务总数或已解决任务数**，因此快照不记录分母，也**不由百分比反推整数计数**。这是与参赛提交路径的关键差别：参赛提交必须给出真实整数计数，而上游导入只保留官网确实公布的百分比。

`official-result-to-envelope.mjs` 会重新校验快照结构、17 条唯一身份、数值范围与日期格式，然后生成 `upstream_author_publication` 结果，签入 [`published-results/`](published-results/)。该类型结果必须含非空 `score`，不能用它冒充一次独立 EvalHub 复跑。

重新生成某一条官网成绩：

```bash
node evals/terminal-bench-harbor/official-result-to-envelope.mjs \
  --participant claude-code-fable-5 \
  --out evals/terminal-bench-harbor/published-results/claude-code-fable-5.json
```

## 提交流程

先安装 npm 当前发布的最新版 EvalHub CLI，下载并审查评测源码：

```bash
npm install -g @evalhub/cli
evalhub fetch terminal-bench-harbor
```

按上游文档在 Harbor 完成三次独立运行后，另建真实提交 JSON。[`tasks/example-submission.json`](tasks/example-submission.json) 只用于展示字段结构和转换器自测，**不是默认提交输入，也不得当作真实成绩**。

每次运行需要一个稳定的公开 HTTPS 证据落地页，以及该次 Harbor 原始 run 输出的 SHA-256。证据应让作者核对原始文件与指纹，但不得公开密钥、临时签名 URL、`.env`、个人信息或未脱敏凭据；URL 不能包含 query、fragment、用户名或密码。

然后用真实 JSON 调用转换器：

```bash
evalhub pack terminal-bench-harbor \
  --input /absolute/path/to/terminal-bench-harbor-submission.json \
  --out /absolute/path/to/terminal-bench-harbor-result.json
evalhub validate /absolute/path/to/terminal-bench-harbor-result.json
evalhub submit /absolute/path/to/terminal-bench-harbor-result.json
```

`evalhub run terminal-bench-harbor` 不会也不应启动这个评测：三次容器运行不在 CLI 的本地 runner 内完成。

转换器不联网、不启动子进程、不下载依赖，也不接触容器或模型服务。它严格检查 JSON 字段、数据集版本、三次运行覆盖、整数计数范围、分母一致性、唯一 run ID、公开 HTTPS 证据 URL 和 SHA-256 格式，并以原子方式写出数值 `score`。缺项、非法计数或非法证据会直接使转换失败，不会生成 `null` 或部分分数。

## 作者复核

`scored_by: author` 表示提交者自报、URL 或哈希本身**不等于已验证**。评测作者至少要核对：

1. artifact 与三份 SHA-256 一致，且公开材料可合法审计；
2. 数据集版本为 `terminal-bench@2.1` 且三次运行覆盖全部任务、分母一致；
3. 三次运行相互独立，未复用环境或结果；
4. Harbor 原始 run 输出的已解决任务数与声明的整数计数逐项一致；
5. 未挑选子集、未跳过失败任务、未修改校验脚本、未单独重试补分；
6. 模型、agent、harness 版本与推理强度有独立运行记录支持。

全部通过后，作者才认可该数值成绩。

## 引用

```bibtex
@inproceedings{terminalbench2026,
  title     = {Terminal-Bench: Benchmarking Agents on Hard, Realistic Tasks in Command Line Interfaces},
  booktitle = {The Fourteenth International Conference on Learning Representations},
  year      = {2026},
  url       = {https://openreview.net/forum?id=a7Qa4CcHak}
}
```
