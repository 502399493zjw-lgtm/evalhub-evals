# RSIBench-Data（数据中心型自改进）

Evolvent AI 提出的 **RSIBench-Data: Benchmarking Data-Centric Research for Recursive Self-Improvement** 评测一个完整“研究者系统”能否在固定外部栈和预算内，把目标模型的失败证据转化为更有效的训练数据：研究者诊断能力缺口，生成并验证 message-format 监督数据，经共享 Tinker LoRA SFT 训练候选检查点，读取受控的 Harbor/E2B 反馈迭代，最后在看到官方结果前选择一个检查点。

- 项目官网：<https://rsibench.co/data/>
- 论文：<https://arxiv.org/abs/2607.25886>
- 作者仓库：<https://github.com/evolvent-ai/RSIBench-Data>
- 当前评测采用的来源 commit：`39948a17925272367b64dd53427a4dba3f572f4e`
- 原作者：Fanqing Meng、Lingxiao Du、Qiguang Chen、Ziqi Zhao、Haocheng Lu、Mengkang Hu、Michael Qizhe Shieh
- 作者单位：Evolvent AI、National University of Singapore（arXiv:2607.25886v1，2026-07-28，cs.SE）
- 协议常量的一手出处：论文主协议原文 “Each main run has a nominal 16-hour wall-clock budget and a $500 Tinker budget.”，来源仓库只在示例里给 14400 秒 / 25 USD，不提供协议默认值，因此 16 小时与 500 USD 两项常量在 `detail_profile` 中引用论文而非仓库

EvalHub 页面与转换器不代表 Evolvent AI、论文作者或 RSIBench 官方榜单的认证、背书或替代实现。EvalHub 不会在受限 runner 内训练模型或执行云端评测；custom runner 只把六项运行声明与证据指纹转换成带数值分数的结果文件。非作者提交的成绩仍由评测作者复核，官网已发表成绩则按来源快照导入。

当前 `protocol_revision: 4` 统一了两条转换路径的宏平均聚合方式：两者都先算六项精确百分比，只在最后一步取六位小数，不再先四舍五入分项再平均。同一组成功计数此前可能因提交路径不同产生 1e-6 量级的分数差异（例如 Opus-4.8 的 26.657615 与 26.657616），现已消除。六项任务、分母和公式本身没有改变。`protocol_revision: 3` 把评测明确标记为外部工作流，并要求转换器接收参赛者实际生成的提交 JSON，不再把仓库内的合成示例当作默认输入。`protocol_revision: 2` 曾专门修正上游参与者身份，把基础模型与 harness 分栏保存。

## 评测对象与固定边界

评测对象是由底层 LLM、agent scaffold、harness 版本和 reasoning effort 共同组成的完整研究者系统。论文 6 明确说明底层 LLM、agent scaffold 与 reasoning effort 三者在主矩阵中绑定比较，并非底层模型的单因素消融；harness 版本是 EvalHub 额外要求声明的运行身份字段（见下文提交要求），论文未作此声明。EvalHub 的结构化身份中，`participant.model` 只保存底层模型，`participant.harness` 单独保存 Codex 或 Claude Code；展示层可以组合两者，但不得再把 harness 塞进模型名。

已发表四位研究者的 reasoning effort 由论文 4.1 给出：两位 Claude Code 研究者跑 `high`，两位 Codex 研究者跑 `max`，四位共享同一固定外部 rollout 模型与相同的任务接口、数据使用约束和预算。该配置已转录进 `detail_profile.overview_tables` 的 `official-researcher-agents`。论文 5.4 还单独做了推理档位诊断：同一 Claude Code Sonnet-5 研究者在 SWE-bench Verified 上，`max` 把前四次可比尝试的平均选择分从 35.5% 提到 44.0%，说明推理档位会改变数据研究策略本身，因此它属于研究者身份而不是可忽略的运行细节。新提交必须声明自己实际使用的档位。

每份成绩必须完成六个相互独立的预算运行，每个运行对应一个 target profile，并符合论文主实验协议：

1. 使用钉死的来源 commit；固定目标模型 `Qwen/Qwen3.5-35B-A3B-Base`，固定外部 rollout 模型 Claude Opus 4.8。rollout 模型对应上游 `.env` 的 `DATA_AGENT_ROLL_MODEL`，指研究者生成的数据脚本在合成训练数据时直接发起 rollout/API 调用所用的模型；它是四位研究者共享的控制变量，与区分他们身份的编排 harness 和编排模型（`DATA_AGENT_HARNESS` / `DATA_AGENT_MODEL`）是不同角色。
2. 每个 profile 单独获得名义 57,600 秒墙钟预算和 500 USD Tinker 预算；六项不能共享或挪用预算。
3. 研究者只能提交 message-format 训练数据和白名单训练配置；训练、服务、Harbor/E2B 环境、agent scaffold、verifier 与评分方式均由来源实现锁定。
4. 评测任务、标签、轨迹和其他仅供评测的受保护材料可用于协议允许的诊断，但不得复制、转换、筛选、蒸馏或作为训练监督。训练数据必须来自该 profile 允许的非 benchmark 公共来源或新合成内容。
5. 必须在看到官方结果前，从预算内已完成的尝试中选择一个检查点；随后由来源的 `run_official_eval.sh` 在新的 E2B 环境中复评，不能继续训练。
6. 运行须保留来源的预算状态、final selection、tamper audit、官方评测摘要与 Harbor 结果，供作者交叉核验。

论文主协议中的“新环境”并不等于统计意义的 held-out 泛化：检查点选择和官方复评使用同一 task subset。结果只能解释为固定协议的可复现性能，不能宣称已证明对未见任务的自适应泛化。

## 六个 profile

| EvalHub task ID | 上游集合 | 数量与尝试 | runner | 原生指标 |
|---|---|---:|---|---|
| `swe-bench-verified` | seed=23 固定 SWE-bench Verified 子集 | 100 × 1 | Mini-SWE-Agent | resolved rate |
| `swe-bench-multilingual` | seed=23 固定 SWE-bench Multilingual 子集 | 100 × 1 | Mini-SWE-Agent | resolved rate |
| `swe-bench-pro` | seed=23 固定 SWE-bench Pro 子集 | 100 × 1 | Mini-SWE-Agent | resolved rate |
| `terminal-bench-2` | Terminal-Bench 2.0 全集 | 89 × 1 | Terminus-2 | task success rate |
| `gpqa-diamond` | seed=23 固定 GPQA Diamond 子集 | 100 × 1 | Terminus-2 | accuracy |
| `aime` | MathArena AIME 2026 全 30 题 | 30 × 4 | Terminus-2 | avg@4 accuracy |

六项都固定 `n_concurrent=32`、`step_limit=200`。AIME 的 `harbor_score` 已包含每题四次解码的上游聚合，转换时不会再次平均。

## 上游官网已发表成绩

官网 <https://rsibench.co/data/> 的完整 Official 矩阵在 2026-07-31 显示以下四位研究者。快照只记录事实数据、来源页面 SHA-256 和派生规则，不复制官网 HTML、图表或运行 artifact。Terminal-Bench 的分母为 89，AIME 的分母为 120；括号内整数成功数是与官网两位小数唯一相容的计数。

| 研究者 | SWE Verified | SWE Multilingual | SWE Pro | Terminal-Bench 2.0 | GPQA | AIME | EvalHub 派生宏平均 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claude Code · Opus-4.8 | 46 | 5 | 2 | 10.11 (9/89) | 56 | 40.83 (49/120) | 26.657615 |
| Claude Code · Sonnet-5 | 35 | 22 | 4 | 5.62 (5/89) | 52 | 49.17 (59/120) | 27.964107 |
| Codex · gpt-5.6-sol | 33 | 15 | 9 | 20.22 (18/89) | 65 | 53.33 (64/120) | 32.593009 |
| Codex · gpt-5.6-terra | 42 | 6 | 1 | 12.36 (11/89) | 64 | 33.33 (40/120) | 26.448814 |

四位研究者的推理档位由论文 4.1 固定：两位 Claude Code 跑 `high`，两位 Codex 跑 `max`。这是比较边界的一部分，已随其余身份字段一起转录进快照的 `protocol_constants.researcher_agents` 和 `detail_profile.overview_tables` 的 `official-researcher-agents` 表；它不写进 `participant.model` 或 `participant.harness`。

本投稿的时间与成本列以钉死的官网快照为准。逐格比对论文 v1 表 2 后发现两处成本单元不同：Claude Code · Sonnet-5 的 Terminal-Bench 2.0 成本官网为 157.85、论文为 156.93；Codex · gpt-5.6-sol 的 AIME 2026 成本官网为 63.87、论文为 63.65。两处都只涉及成本列，24 个 Official 分数与 6 个 base 行在两个来源上逐格一致，排名与派生宏平均不受影响。此处不做取舍或平均，只声明以官网快照为转录源并记录差异。

[`tasks/rsibench-official-results-2026-07-31.json`](tasks/rsibench-official-results-2026-07-31.json) 是可机读快照；`official-result-to-envelope.mjs` 会重新验证四位研究者的独立 `model` / `harness` 身份、六项分母、官网显示值与整数计数及宏平均，然后生成 `upstream_author_publication` 结果。该类型的结果必须含非空 `score`，不能用它冒充一次独立 EvalHub 复跑。

2026-08-08 重新抓取官网页面复核：页面 SHA-256 仍为 `c1ada61368496e1edf694dbf10a6e3a972f4bffc6e857f45351f05578f8df4fa`，与 2026-07-31 快照完全一致，四位研究者的 24 个分项分数无变化，因此不新增快照文件。官网矩阵还给出两类不计分的旁证列。一是每个 benchmark 的 base model 参考行，即目标模型未经微调的成绩（SWE Verified 12.00%、SWE Multilingual 7.00%、SWE Pro 0.00%、GPQA 61.00%、AIME 2026 30.00%、Terminal-Bench 2.0 1.12%；后两项与固定分母相容的唯一整数计数分别是 36/120 和 1/89）；base 行不消耗研究预算，其用时与成本格为空。二是四位研究者 24 个格子各自的实际用时与 Tinker 成本，用时介于 1.14 至 14.91 小时，成本介于 4.80 至 363.77 USD，全部落在每项 16 小时、500 USD 的预算上限内。

本次更新把这两类旁证按其真实性质收录：它们**不进入 `score`、不产生新参赛者**，而是作为展示视图转录进快照的 `base_reference` 与每位研究者的 `resource_use`，再由生成器输出到 `official-benchmark-breakdown` 的基线对照列和 `official-time-cost` 表。base 行仍不是研究者提交，因此不会成为第五位参赛者；`Qwen/Qwen3.5-35B-A3B-Base` 也不在平台模型登记表内，把它当参赛者会直接触发 `checkModelStrings` 的未知模型门禁。转录时逐格与官网当前页面重新比对，78 个数值全部一致。评分输入仍然只有 Official 一列，这一点由快照的 `score_authority.rule` 明文固定。

同日复核上游仓库：钉死的 `39948a17925272367b64dd53427a4dba3f572f4e` 之后，默认分支已推进到 `4c807610243e7b481d382c5ed360c71c79a22f61`（2026-08-06），其间新增 9 个 commit，内容为 Kimi Code data agent harness、Tinker eval proxy 默认改用 SDK 后端、官方评测 Python 环境修复，以及 Docker 隔离的 session runner 与其 artifact 归档。逐一比对两个版本后确认：`benchmarks/*/spec.json` 完全未改动，六个 profile 的数据集、任务数、尝试次数与 Harbor agent 保持原样；`runner/run_official_eval.sh` 的改动全部是改用 venv 优先的 `PYTHON_BIN`、新增运行环境检查与日志重定向，`harbor_score` 提取与 `n_tasks` / `n_attempts` / `step_limit` 的传递逻辑逐行不变；新增的 Kimi Code 是与 Claude Code、Codex 并列的第三个可选编排 harness，不改变已发表四位研究者的运行口径。

其中一条改动需要单独说明：`fa785fa` 把 Tinker eval proxy 的后端选择从「`tinker://` 检查点走 OpenAI 兼容 HTTP shim、base model 走 SDK」改为一律使用 SDK SamplingClient。它不改动任何协议常量、数据集、分母或分数提取逻辑，但**确实改变了官方复评时检查点采样所走的服务路径**，而服务实现正属于上述第 3 条锁定项。已发表的四位研究者成绩产生于钉死的 `39948a17`，不受影响；这条变更本身正是来源 commit 不能随默认分支上移的理由——上移会让此后的官方复评与已导入基线处在不同的服务路径上。因此来源 commit 保持钉死、不随默认分支上移；未来若要上移，需先评估该服务路径变更对可比性的影响。

四份生成后的信封签入 [`published-results/`](published-results/)：仓库同步时会把它们作为当前评测版本的受信官方基线导入。每份信封同时提供用于总体榜单的数值宏平均，以及两张 `supplementary_views` 表：`official-benchmark-breakdown` 给出官网显示值、成功次数、固定分母、精确分项分数和未微调基线模型对照列，`official-time-cost` 给出官网同表的每项用时与 Tinker 成本。两张表在四份信封里共用同一组 `id` / `type` / `title` / `label` / `columns`，只有 `rows` 随研究者不同，平台因此可以安全地按分项派生对比视图。上游发表结果不伪装成本地逐题运行，因此不写 `task_results`；这样总体排名保持单一口径，详情页仍能审计和比较所有非整体信息。`score_policy: required` 禁止提交 `null` 分数；`baseline_policy: required` 还要求每个发布版本至少成功导入一条非空官方基线，否则该版本不能被投稿任务误判为发布完成。

## 输入声明与公开证据

完成来源仓库的六次官方运行后，参赛者创建一个与 [`tasks/example-submission.json`](tasks/example-submission.json) 同结构的 JSON。声明包含：

- 有日期版本的研究者模型 ID、harness、harness 版本、provider 和实际 reasoning effort；
- 钉死的来源、目标模型、rollout 模型与每项预算；
- 六个唯一 run ID、来源 profile 的锁定参数和整数 `successful_trials`；
- 每次运行一个稳定的公开 HTTPS 证据落地页，以及 `official_eval.json`、Harbor `result.json` 和完整性审计报告的 SHA-256。

证据落地页应让作者核对原始文件与指纹，但不得公开密钥、临时签名 URL、`.env`、个人信息、目标 benchmark 的受保护任务/标签、未脱敏推理、Tinker 或 E2B 凭据。URL 不能包含 query、fragment、用户名或密码。若许可证或数据协议不允许公开某个原始文件，应发布允许分发的白名单摘要，并向作者提供可审计的合法来源；不能靠删除关键字段制造“通过验证”的假象。

先在一个独立工作目录安装 npm 当前发布的最新版 EvalHub CLI，下载并审查评测源码：

```bash
npm install -g @evalhub/cli
evalhub fetch rsibench-data
```

`evalhub fetch` 会打印评测目录和 pinned commit。根据打印路径找到该 checkout 的仓库根目录，检查 `package.json`、`package-lock.json`、本 README 和转换器源码后，在这个 pinned checkout 根目录显式安装锁定依赖，再回到最初执行 `evalhub fetch` 的工作目录：

```bash
export EVALHUB_EVALS_ROOT="/absolute/path/to/pinned/evalhub-evals-checkout"
(
  cd "$EVALHUB_EVALS_ROOT"
  npm ci --ignore-scripts
)
```

CLI 不会也不应静默安装候选仓库依赖。不要在 pinned checkout 中运行 `npm install`，因为它可能改写锁文件并触发洁净性检查；后续 `evalhub pack` 仍须从最初执行 `evalhub fetch` 的工作目录运行，才能复用同一个 checkout。

按本 README 和上游 RSIBench-Data 文档，在 Harbor/E2B/Tinker 完成六次独立运行后，另建真实提交 JSON。[`tasks/example-submission.json`](tasks/example-submission.json) 只用于展示字段结构和转换器自测，不是默认提交输入，也不得当作真实成绩。然后让 CLI 用该真实 JSON 调用钉死 commit 内的转换器：

```bash
evalhub pack rsibench-data \
  --input /absolute/path/to/rsibench-data-submission.json \
  --out /absolute/path/to/rsibench-data-result.json
evalhub validate /absolute/path/to/rsibench-data-result.json
evalhub submit /absolute/path/to/rsibench-data-result.json
```

`evalhub run rsibench-data` 不会也不应启动这个评测：外部六次运行不在 CLI 的本地 runner 内完成。

转换器不联网、不启动子进程、不下载依赖，也不接触 Tinker、E2B、Harbor 或模型服务。它只对声明格式与内部一致性做检查，包括 JSON 字段、固定协议、六项覆盖、整数成功次数、唯一 ID、公开 HTTPS 证据 URL 和 SHA-256 格式，并以原子方式写出六项等权宏平均的数值 `score`。缺项、非法计数或非法证据会直接使转换失败，不会生成 `null` 或部分分数；公开 artifact 内容、模型身份、运行过程及成绩真实性仍须评测作者审核。

重新生成仓库中四份上游官网成绩结果：

```bash
node evals/rsibench-data/official-result-to-envelope.mjs --participant claude-code-opus-4.8 --out evals/rsibench-data/published-results/claude-code-opus-4.8.json
node evals/rsibench-data/official-result-to-envelope.mjs --participant claude-code-sonnet-5 --out evals/rsibench-data/published-results/claude-code-sonnet-5.json
node evals/rsibench-data/official-result-to-envelope.mjs --participant codex-gpt-5.6-sol --out evals/rsibench-data/published-results/codex-gpt-5.6-sol.json
node evals/rsibench-data/official-result-to-envelope.mjs --participant codex-gpt-5.6-terra --out evals/rsibench-data/published-results/codex-gpt-5.6-terra.json
```

## 计分、容错与复核

每个 profile 的分项分数由整数成功次数和固定试验总数确定：`successful_trials ÷ (n_tasks × n_attempts) × 100`。该比值应与上游官方 `harbor_score × 100` 完全对应：

- 三个 SWE profile 沿用 resolved rate；
- Terminal-Bench 2.0 沿用 task success rate；
- GPQA Diamond 与 AIME 沿用 accuracy，AIME 是上游 avg@4。

分项展示分数取到小数点后最多 6 位；派生宏平均则先用未取整的六项精确百分比求等权平均，只在最后一步取六位小数，不先取整分项再平均——两条转换路径在这一点上完全一致，同一组成功计数只会得到同一个排名分。上游把 task error 和 timeout 反映在 Harbor 分数中，因此它们仍按失败计入，不做额外豁免、插值或“最佳重试”替换。输入不接受任意浮点分数：三项 SWE 与 GPQA 的分母为 100，Terminal-Bench 为 89，AIME 为 120；runner 从整数计数唯一派生分数，避免不可能的分数刻度或浮点容差争议。作者仍须把计数与 Harbor 聚合结果逐项交叉核对。

论文和作者仓库没有定义跨六个 profile 的单一总分。为了适配 EvalHub 单榜，当前评测定义使用六项百分制分数的等权算术平均作为展示分数；这是明确标注的 **EvalHub 派生指标**，不是 RSIBench-Data 官方复合指标，也不是相对 base model 的提升值。缺少任一 profile 或任一运行不合规时整份提交不判分，不计算部分总分。

custom runner 输出六个 `task_results`、数值派生平均和证据索引。平台上的认可状态与分数是否存在是两件事：非作者提交可先带数值分数但保持待认可；评测作者本人提交且分数非空时，平台可按作者身份认可。评测作者至少要核对：

1. artifact 与三个 SHA-256 一致且公开材料可合法审计；
2. 来源 remote/commit、六个独立预算状态、目标与 rollout 模型符合固定协议；
3. `final_selection.json` 在官方评测前产生，且选择的是已完成候选；
4. `official_eval.json` 与 Harbor `result.json` 的 profile、参数、run ID、所选 checkpoint、成功次数和 score 互相一致；
5. tamper audit、数据来源和训练集没有违反评测数据边界；
6. 研究者身份、harness、版本和 reasoning effort 有独立运行记录支持。

全部通过后，作者才认可该数值成绩。提交者自报、URL 或哈希本身不等于已验证。官网四位研究者的结果走独立的上游发表来源导入路径，其可信范围只是“与钉死的官方页面一致”，不是对运行 artifact 的二次独立审计。

## 许可证、分发与引用

本目录没有复制上游代码、数据集、benchmark 任务、论文图表或运行 artifact；示例 JSON 完全是合成数据。来源仓库根目录在当前评测定义采用该版本时没有 `LICENSE`、`COPYING` 或 `NOTICE` 文件，GitHub 也没有识别出仓库许可证，但 README 徽章链接到 CC BY-NC 4.0。论文的 arXiv 页面单独标注为 CC BY 4.0。论文许可不会自动替代代码、子模块、上游 benchmark 与数据集各自的许可，因此本目录只链接并钉死来源，不重新分发不明或受限内容。实际运行者须分别遵守 RSIBench-Data、Tinker、Harbor、E2B、seed repositories 和六个目标 benchmark 的当前条款。

引用论文：

```bibtex
@misc{meng2026rsibenchdata,
  title         = {RSIBench-Data: Benchmarking Data-Centric Research for Recursive Self-Improvement},
  author        = {Fanqing Meng and Lingxiao Du and Qiguang Chen and Ziqi Zhao and Haocheng Lu and Mengkang Hu and Michael Qizhe Shieh},
  year          = {2026},
  eprint        = {2607.25886},
  archivePrefix = {arXiv},
  primaryClass  = {cs.SE},
  url           = {https://arxiv.org/abs/2607.25886}
}
```
