# CEO-Bench（NovaMind 创业经营）

Princeton University 的 **CEO-Bench: Can Agents Play the Long Game?** 让 agent 经营虚构的 NovaMind AI SaaS 公司：以 1,000,000 美元开局，持续做定价、产品、营销、研发、算力和企业客户决策，目标是最大化终局现金。

- 项目官网：<https://ceobench.com/>
- 论文：<https://arxiv.org/abs/2606.18543>
- 官方源码仓库：<https://github.com/zlab-princeton/ceobench-src>
- 官方可运行仓库：<https://github.com/zlab-princeton/run-ceobench>
- 当前评测采用的可运行仓库 commit：`f5d500688d95256906fd02cc5aa7524f2fe08d5b`
- 原作者：Haozhe Chen、Karthik Narasimhan、Zhuang Liu（Princeton University）
- 一手来源台账：[`tasks/source-ledger-2026-08-08.json`](tasks/source-ledger-2026-08-08.json)

本目录同时支持两类成绩，但不会混淆它们的来源：

- **Princeton 官方公开成绩**：以 <https://ceobench.com/> 的结果表为分数权威来源，由本评测作者核对固定来源快照后录入。这只表示“Princeton 官网公开发布了该成绩”，不表示 EvalHub 独立复跑成功。
- **新的 EvalHub 证据提交**：参赛者按下述固定复现配置提交三次运行证据，仍需本评测作者核对、判分和认可。

页面统一展示模型、终局现金和完成状态，不要求在每条成绩旁标出底层运行天数。来源快照与运行证据仍保留已公开的实际终点，供作者审计；省略公开标签不代表不同运行配置已经被证明完全等价。

18 份 Princeton 官网成绩由钉死的 [`tasks/princeton-official-results-2026-08-03.json`](tasks/princeton-official-results-2026-08-03.json) 确定性生成并签入 [`published-results/`](published-results/)。每份信封保持唯一主排名分数为官网 Best-run cash，并在 `supplementary_views` 中逐项保留破产次数、最长存活天数、官网显示的平均存活天数、Turns/week、规则策略基线和估算上界；这些辅助值不参与单独排名。同步服务把这些 `upstream_author_publication` 信封绑定到当前成绩协议版本，因此新数据库和已有部署都不再依赖一次性的历史手工导入。它们只有上游公开的模型身份，不虚构未发布的 harness 或 harness 版本，也不附带 EvalHub `usage`、`task_results` 或 `showcases`。

EvalHub 页面与转换器不代表 Princeton 官方认证或作者背书。两个上游 GitHub 仓库在当前评测定义采用该版本时没有代码许可证，因此这里只链接并固定官方来源，不复制或重新发布其代码、文档、数据库或二进制。论文页面的 CC BY 4.0 标记不自动授权这些仓库内容。

## 一手来源与版本边界

[`tasks/source-ledger-2026-08-08.json`](tasks/source-ledger-2026-08-08.json) 逐项记录来源 URL、可支持的事实、允许映射到的投稿字段以及版本和许可边界。主要版本关系如下：

- Princeton 官网结果表是模型分数和汇总指标的唯一权威来源。2026-08-08 复核时页面字节与 2026-08-03 快照一致，SHA-256 仍为 `97475ea055b55a7b83d7917cc6b8defaab82f3fdeaf216b16ef8c54e8f31b292`。
- 源码研究固定在 `ceobench-src@d2b7b32e5301a571b77f5f68bd1032adbcd5b464`；论文说明固定为 `arXiv:2606.18543v2`。论文 v2 标注 CC BY 4.0，但它早于官网后来加入的模型，因此论文图只用于解释任务和长周期趋势，不覆盖当前官网成绩。
- 当前 EvalHub `protocol_revision: 3` 继续固定 `run-ceobench@f5d500688d95256906fd02cc5aa7524f2fe08d5b`。上游当前 main 已有后续模拟与计费修复，但没有一手证据证明官网 18 份成绩已全部按该新版重新运行；静默更换 pin 会改变可比性，因此本次来源和展示维护不更换执行协议。
- 轨迹清单只支持 run ID、公开终点和破产状态等来源审计。它包含异质运行时长、缺少 Grok 4.5，并与官网的 Gemini 3.5 Flash 批次冲突；2026-08-08 复核时实时清单已推进到 v15（17 模型 / 51 运行），钉死的 v12 摘要仍是审计参考。本目录不据此改写官网分数，也不复制没有单独数据许可证的逐日曲线。

当前 `protocol_revision: 3` 把评测明确标记为外部工作流，并要求转换器接收参赛者实际生成的提交 JSON。`protocol_revision: 1` 的正式命令曾引用仓库内的合成示例；`protocol_revision: 2` 改变执行方式和输入身份契约，要求提交证据由参赛者真实生成。`protocol_revision: 3` 起，task `prompt` 逐字保留上游 simulator 指令原文（含未替换的 `{total_days}` 等模板占位符），EvalHub 自己的复现规程移入 `run_spec`，因此改变了任务语句和执行规程的载体，旧版本成绩不会被误认为与当前提交链路可直接比较。

## EvalHub 固定复现配置

每个成绩必须提供三次运行，并且三次运行都满足：

1. 从官方 `run-ceobench` 的钉死 commit 建立一个全新的独立工作副本。
2. 该工作副本中只创建一个 session。
3. 以 `./novamind-operation new-session --days 497 --seed 42` 创建 session；初始现金为默认的 1,000,000 USD，场景为 `default`。
4. 三次运行使用相同的 simulator LLM 配置和同一参赛模型、provider、最高推理强度及 harness 版本。提交声明统一填写 `reasoning_effort: "max"`，作者再核对所用 runner 的实际最高档配置。
5. agent 运行 71 个完整周，到第 497 天结束；若现金严格小于 0，则在当周提前破产。未破产却提前停止的运行无效。
6. 遵守官方反作弊边界：不得读取、解密、解压、反汇编或以其他方式检查 `world.nmdb` 与 `novamind-operation`。

为什么这套复现配置停在 497 天：官方源码的 bash、Claude Code 和 Codex 三套基线会把 `--days 500` 向下归一为 71 个完整周，并以 `497` 创建 session。公开 CLI 的 `next-week` 每次只能前进 7 天，没有剩余 3 天的推进命令；若从 497 再推进一次会到 504 天。为保证新的 EvalHub 证据提交可复现、可比较，当前评测定义固定 71 个整周的边界，并拒绝 500、504 或其他非破产终点。它是 EvalHub 的固定复现配置，不是对所有 Princeton 历史运行配置的重新命名。

每周推进所需的 rationale 和四个时间跨度的现金预测可保留在参赛者自己的私有运行目录中作为诊断。公开证据只保留每周推进日和规定的终局现金查询；官方公开材料没有给出将预测指标与终局现金合成一个总分的权重，因此本评测不虚构综合分。

## 跑三次并采集证据

先在一个独立工作目录安装当前发布的 EvalHub CLI，下载并审查钉死的评测源码：

```bash
npm install -g @evalhub/cli
evalhub fetch ceo-bench
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

先在三个不同目录各自完成一次官方运行。不要在同一个工作副本里创建三个 session。

在 pinned checkout 之外创建一份完整提交目录，避免污染钉死源码。`submission.json` 与三个证据目录必须在同一父目录，不能只把 manifest 单独复制到其他位置：

```bash
export CEOBENCH_SUBMISSION_ROOT="/absolute/path/to/original-workdir/ceobench-submission"
mkdir -p "$CEOBENCH_SUBMISSION_ROOT"/run-{1,2,3}
cp "$EVALHUB_EVALS_ROOT/evals/ceo-bench/tasks/example-evidence/submission.json" \
  "$CEOBENCH_SUBMISSION_ROOT/submission.json"
```

复制后立即编辑 `$CEOBENCH_SUBMISSION_ROOT/submission.json`：替换全部合成的 `participant.model`、`participant.harness`、`participant.harness_version`、`participant.config.provider` 和三个 `artifact_url`，并确认它们指向本次真实的模型、runner 版本与公开证据。不要原样提交 `example/synthetic-agent-20260723` 或 `example.com` 值；三个 `evidence_dir` 继续保持为该 manifest 同目录下的 `run-1`、`run-2`、`run-3`。

每次结束后，设置这三个非敏感路径变量。把示例值换成当前 EvalHub evals 仓库、该次官方运行副本和本次输出目录的绝对路径；`CEOBENCH_SESSION_ID` 换成该次唯一的 session ID：

```bash
export CEOBENCH_RUN_ROOT="/absolute/path/to/run-ceobench-copy-1"
export CEOBENCH_EVIDENCE_DIR="$CEOBENCH_SUBMISSION_ROOT/run-1"
export CEOBENCH_SESSION_ID="<session-id>"

cd "$CEOBENCH_RUN_ROOT"
git remote get-url origin > "$CEOBENCH_EVIDENCE_DIR/source-remote.txt"
git rev-parse HEAD > "$CEOBENCH_EVIDENCE_DIR/source-commit.txt"
./novamind-operation list-sessions > "$CEOBENCH_EVIDENCE_DIR/list-sessions.json"
./novamind-operation status > "$CEOBENCH_EVIDENCE_DIR/status.json"
./novamind-operation query "SELECT COALESCE(SUM(amount), 0) AS final_cash FROM ledger" \
  > "$CEOBENCH_EVIDENCE_DIR/final-cash.json"
node "$EVALHUB_EVALS_ROOT/evals/ceo-bench/sanitize-history.mjs" \
  "$CEOBENCH_RUN_ROOT/sessions/$CEOBENCH_SESSION_ID/history.jsonl" \
  --out "$CEOBENCH_EVIDENCE_DIR/history.jsonl"
```

对 `run-2`、`run-3` 重复相同步骤，并相应修改运行副本和输出目录。脱敏工具采用字段白名单：`next_week` 只输出 `type`、`day`，只保留规定的成功终局现金查询；它会丢弃 rationale、predictions、时间戳、Python 代码片段、其他查询和未知事件。转换器会拒绝任何未经规范化脱敏的公开 history。

不要复制原始 `history.jsonl`，也不要把 `world.nmdb`、`novamind-operation`、环境变量、`.env`、API key、原始推理或其他私密文件放进证据包。脱敏 history 只能证明公开的推进轨迹和终局查询结构，不能单独证明模型身份或未作弊；作者仍需结合独立 runner 记录审查。

把三个证据目录分别压缩并上传到稳定的公开 HTTPS 地址，供评测作者复核。URL 不得包含 query 参数、fragment、用户名、密码或临时签名。公开 URL 和 SHA-256 只能证明作者看到的文件与提交时一致，不能让成绩自动变成“已验证”。

## 生成结果

再次检查 `$CEOBENCH_SUBMISSION_ROOT/submission.json`。`participant.model` 必须包含与 `participant.config.provider` 一致的 provider 命名空间，并以真实模型发布日期结尾，例如 `anthropic/claude-sonnet-4-6-20260217`。`participant.config.reasoning_effort` 必须填写标准化值 `"max"`。三个 `artifact_url` 必须是对应这三个真实证据包的稳定公开 HTTPS 地址；三个 `evidence_dir` 保持为同目录下的 `run-1`、`run-2`、`run-3`。

然后回到最初执行 `evalhub fetch` 的工作目录，让 CLI 把真实 manifest 传给钉死 commit 内的转换器：

```bash
cd "/absolute/path/to/original-workdir"
evalhub pack ceo-bench \
  --input "$CEOBENCH_SUBMISSION_ROOT/submission.json" \
  --out "$PWD/ceo-bench-result.json"
evalhub validate "$PWD/ceo-bench-result.json"
evalhub submit "$PWD/ceo-bench-result.json"
```

转换器不调用模型，也不读取上游受保护文件。它只对声明格式与内部一致性做检查，包括恰好三次独立运行、官方 remote 与 commit、协议参数、session 交叉一致性、运行是否完整、严格脱敏的逐周 history、唯一终局现金查询、文件大小与 SHA-256，并以原子方式写结果；公开 artifact 内容、模型身份、运行过程及成绩真实性仍须评测作者审核。

转换器始终输出 `score: null`。平台接收后仍是待作者判分、待认可状态。

重新生成签入仓库的 18 份 Princeton 官网成绩：

```bash
node evals/ceo-bench/official-result-to-envelope.mjs \
  --all \
  --out-dir evals/ceo-bench/published-results
```

转换器会校验模型唯一性、官网金额、三次运行、破产数、状态和最长存活天数，再用共享 schema 与本目录 `eval.yaml` 做上下文校验。输出不写 `eval_commit`；仓库同步时会把它绑定到该评测当前接受的成绩协议 commit。

## 公开计分

- 至少一次运行非破产地完成第 497 天（71 个整周）：在所有完整运行中，取终局现金最高者；作者回填该 `final_cash`，单位 USD。
- 三次均破产：作者回填 `0 USD`；代表运行取存活天数最长者，同存活日时终局现金较高者优先。
- 榜单同分：按代表运行存活天数降序。
- 任意一次运行未破产却未精确结束于第 497 天、协议参数不一致、session 数量不是 1、证据不齐或不可信：整次提交不判分。

作者复核时还要确认三个公开 artifact 的内容与结果中的 SHA-256 一致，并判断材料是否足以证明反作弊规则、模型身份、provider、reasoning effort、harness 版本和三次独立执行。提交者的声明不等于作者验证。

## 示例声明

`tasks/example-evidence/` 是一份可直接复制的完整合成提交目录，`sample-result.json` 是它生成的结果；二者只用于测试转换与校验，绝不代表任何模型的真实 CEO-Bench 成绩。
