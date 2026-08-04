# RSIBench-Data（数据中心型自改进）

Evolvent AI 提出的 **RSIBench-Data: Benchmarking Data-Centric Research for Recursive Self-Improvement** 评测一个完整“研究者系统”能否在固定外部栈和预算内，把目标模型的失败证据转化为更有效的训练数据：研究者诊断能力缺口，生成并验证 message-format 监督数据，经共享 Tinker LoRA SFT 训练候选检查点，读取受控的 Harbor/E2B 反馈迭代，最后在看到官方结果前选择一个检查点。

- 项目官网：<https://rsibench.co/data/>
- 论文：<https://arxiv.org/abs/2607.25886>
- 作者仓库：<https://github.com/evolvent-ai/RSIBench-Data>
- 当前评测采用的来源 commit：`39948a17925272367b64dd53427a4dba3f572f4e`
- 原作者：Fanqing Meng、Lingxiao Du、Qiguang Chen、Ziqi Zhao、Haocheng Lu、Mengkang Hu、Michael Qizhe Shieh

EvalHub 页面与转换器不代表 Evolvent AI、论文作者或 RSIBench 官方榜单的认证、背书或替代实现。EvalHub 不会在受限 runner 内训练模型或执行云端评测；custom runner 只把六项运行声明与证据指纹转换成带数值分数的结果文件。非作者提交的成绩仍由评测作者复核，官网已发表成绩则按来源快照导入。

当前 `protocol_revision: 3` 把评测明确标记为外部工作流，并要求转换器接收参赛者实际生成的提交 JSON，不再把仓库内的合成示例当作默认输入。`protocol_revision: 2` 曾专门修正上游参与者身份，把基础模型与 harness 分栏保存。六项任务和宏平均计分公式没有改变。

## 评测对象与固定边界

评测对象是由底层 LLM、agent scaffold、harness 版本和 reasoning effort 共同组成的完整研究者系统。论文也明确说明这些因素在主矩阵中绑定比较，并非底层模型的单因素消融。EvalHub 的结构化身份中，`participant.model` 只保存底层模型，`participant.harness` 单独保存 Codex 或 Claude Code；展示层可以组合两者，但不得再把 harness 塞进模型名。

每份成绩必须完成六个相互独立的预算运行，每个运行对应一个 target profile，并符合论文主实验协议：

1. 使用钉死的来源 commit；固定目标模型 `Qwen/Qwen3.5-35B-A3B-Base`，固定外部 rollout 模型 Claude Opus 4.8。
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

[`tasks/rsibench-official-results-2026-07-31.json`](tasks/rsibench-official-results-2026-07-31.json) 是可机读快照；`official-result-to-envelope.mjs` 会重新验证四位研究者的独立 `model` / `harness` 身份、六项分母、官网显示值与整数计数及宏平均，然后生成 `upstream_author_publication` 结果。该类型的结果必须含非空 `score`，不能用它冒充一次独立 EvalHub 复跑。

四份生成后的信封签入 [`published-results/`](published-results/)：仓库同步时会把它们作为当前评测版本的受信官方基线导入。每份信封同时提供用于总体榜单的数值宏平均，以及带官网显示值、成功次数、固定分母和精确分项分数的 `supplementary_views` 表。上游发表结果不伪装成本地逐题运行，因此不写 `task_results`；这样总体排名保持单一口径，详情页仍能审计和比较所有非整体信息。`score_policy: required` 禁止提交 `null` 分数；`baseline_policy: required` 还要求每个发布版本至少成功导入一条非空官方基线，否则该版本不能被投稿任务误判为发布完成。

## 输入声明与公开证据

完成来源仓库的六次官方运行后，参赛者创建一个与 [`tasks/example-submission.json`](tasks/example-submission.json) 同结构的 JSON。声明包含：

- 有日期版本的研究者模型 ID、harness、harness 版本、provider 和实际 reasoning effort；
- 钉死的来源、目标模型、rollout 模型与每项预算；
- 六个唯一 run ID、来源 profile 的锁定参数和整数 `successful_trials`；
- 每次运行一个稳定的公开 HTTPS 证据落地页，以及 `official_eval.json`、Harbor `result.json` 和完整性审计报告的 SHA-256。

证据落地页应让作者核对原始文件与指纹，但不得公开密钥、临时签名 URL、`.env`、个人信息、目标 benchmark 的受保护任务/标签、未脱敏推理、Tinker 或 E2B 凭据。URL 不能包含 query、fragment、用户名或密码。若许可证或数据协议不允许公开某个原始文件，应发布允许分发的白名单摘要，并向作者提供可审计的合法来源；不能靠删除关键字段制造“通过验证”的假象。

先安装 npm 当前发布的最新版 EvalHub CLI，下载并审查评测源码：

```bash
npm install -g @evalhub/cli
evalhub fetch rsibench-data
```

按本 README 和上游 RSIBench-Data 文档，在 Harbor/E2B/Tinker 完成六次独立运行后，另建真实提交 JSON。[`tasks/example-submission.json`](tasks/example-submission.json) 只用于展示字段结构和转换器自测，不是默认提交输入，也不得当作真实成绩。然后让 CLI 用该真实 JSON 调用钉死 commit 内的转换器：

```bash
evalhub pack rsibench-data \
  --input /absolute/path/to/rsibench-data-submission.json \
  --out /absolute/path/to/rsibench-data-result.json
evalhub validate /absolute/path/to/rsibench-data-result.json
evalhub submit /absolute/path/to/rsibench-data-result.json
```

`evalhub run rsibench-data` 不会也不应启动这个评测：外部六次运行不在 CLI 的本地 runner 内完成。

转换器不联网、不启动子进程、不下载依赖，也不接触 Tinker、E2B、Harbor 或模型服务。它严格检查 JSON 字段、固定协议、六项覆盖、整数成功次数、唯一 ID、公开 HTTPS 证据 URL 和 SHA-256 格式，并以原子方式写出六项等权宏平均的数值 `score`。缺项、非法计数或非法证据会直接使转换失败，不会生成 `null` 或部分分数。

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

转换器将分项与派生宏平均规范到小数点后最多 6 位。上游把 task error 和 timeout 反映在 Harbor 分数中，因此它们仍按失败计入，不做额外豁免、插值或“最佳重试”替换。输入不接受任意浮点分数：三项 SWE 与 GPQA 的分母为 100，Terminal-Bench 为 89，AIME 为 120；runner 从整数计数唯一派生分数，避免不可能的分数刻度或浮点容差争议。作者仍须把计数与 Harbor 聚合结果逐项交叉核对。

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
