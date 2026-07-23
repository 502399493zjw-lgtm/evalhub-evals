# CEO-Bench（500-day / 71 整周协议）

这是 Princeton University 的 **CEO-Bench: Can Agents Play the Long Game?** 的第三方 EvalHub 接入。CEO-Bench 让 agent 经营虚构的 NovaMind AI SaaS 公司：以 1,000,000 美元开局，持续做定价、产品、营销、研发、算力和企业客户决策，目标是最大化终局现金。

- 项目官网：<https://ceobench.com/>
- 论文：<https://arxiv.org/abs/2606.18543>
- 官方源码仓库：<https://github.com/zlab-princeton/ceobench-src>
- 官方可运行仓库：<https://github.com/zlab-princeton/run-ceobench>
- 本接入钉死的可运行仓库 commit：`f5d500688d95256906fd02cc5aa7524f2fe08d5b`
- 原作者：Haozhe Chen、Karthik Narasimhan、Zhuang Liu（Princeton University）

本目录不是 Princeton 官方榜单、官方认证或作者背书。两个上游 GitHub 仓库在本接入时没有代码许可证，因此这里只链接并固定官方来源，不复制或重新发布其代码、文档、数据库或二进制。论文页面的 CC BY 4.0 标记不自动授权这些仓库内容。

## 协议

每个成绩必须提供三次运行，并且三次运行都满足：

1. 从官方 `run-ceobench` 的钉死 commit 建立一个全新的独立工作副本。
2. 该工作副本中只创建一个 session。
3. 以 `./novamind-operation new-session --days 497 --seed 42` 创建 session；初始现金为默认的 1,000,000 USD，场景为 `default`。
4. 三次运行使用相同的 simulator LLM 配置和同一参赛模型、provider、最高推理强度及 harness 版本。提交声明统一填写 `reasoning_effort: "max"`，作者再核对所用 runner 的实际最高档配置。
5. agent 运行 71 个完整周，到第 497 天结束；若现金严格小于 0，则在当周提前破产。未破产却提前停止的运行无效。
6. 遵守官方反作弊边界：不得读取、解密、解压、反汇编或以其他方式检查 `world.nmdb` 与 `novamind-operation`。

为什么名义是 500 天，证据却必须停在 497 天：官方源码的 bash、Claude Code 和 Codex 三套基线都会把 `--days 500` 向下归一为 71 个完整周，并以 `497` 创建 session。公开 CLI 的 `next-week` 每次只能前进 7 天，没有剩余 3 天的推进命令；若从 497 再推进一次会到 504 天，多运行 4 天。为保证所有提交可复现、可比较，本接入固定官方基线的 71 整周边界，并拒绝 500、504 或其他非破产终点。

每周推进所需的 rationale 和四个时间跨度的现金预测可保留在参赛者自己的私有运行目录中作为诊断。公开证据只保留每周推进日和规定的终局现金查询；官方公开材料没有给出将预测指标与终局现金合成一个总分的权重，因此本评测不虚构综合分。

## 跑三次并采集证据

先在三个不同目录各自完成一次官方运行。不要在同一个工作副本里创建三个 session。

从 EvalHub evals 仓库根目录创建一份完整提交目录。`submission.json` 与三个证据目录必须在同一父目录，不能只把 manifest 单独复制到其他位置：

```bash
mkdir -p ceobench-500d-submission/run-{1,2,3}
cp evals/ceo-bench-500d/tasks/example-evidence/submission.json \
  ceobench-500d-submission/submission.json
```

每次结束后，设置这三个非敏感路径变量。把示例值换成当前 EvalHub evals 仓库、该次官方运行副本和本次输出目录的绝对路径；`CEOBENCH_SESSION_ID` 换成该次唯一的 session ID：

```bash
export EVALHUB_EVALS_ROOT="/absolute/path/to/evalhub-evals"
export CEOBENCH_RUN_ROOT="/absolute/path/to/run-ceobench-copy-1"
export CEOBENCH_EVIDENCE_DIR="$EVALHUB_EVALS_ROOT/ceobench-500d-submission/run-1"
export CEOBENCH_SESSION_ID="<session-id>"

cd "$CEOBENCH_RUN_ROOT"
git remote get-url origin > "$CEOBENCH_EVIDENCE_DIR/source-remote.txt"
git rev-parse HEAD > "$CEOBENCH_EVIDENCE_DIR/source-commit.txt"
./novamind-operation list-sessions > "$CEOBENCH_EVIDENCE_DIR/list-sessions.json"
./novamind-operation status > "$CEOBENCH_EVIDENCE_DIR/status.json"
./novamind-operation query "SELECT COALESCE(SUM(amount), 0) AS final_cash FROM ledger" \
  > "$CEOBENCH_EVIDENCE_DIR/final-cash.json"
node "$EVALHUB_EVALS_ROOT/evals/ceo-bench-500d/sanitize-history.mjs" \
  "$CEOBENCH_RUN_ROOT/sessions/$CEOBENCH_SESSION_ID/history.jsonl" \
  --out "$CEOBENCH_EVIDENCE_DIR/history.jsonl"
```

对 `run-2`、`run-3` 重复相同步骤，并相应修改运行副本和输出目录。脱敏工具采用字段白名单：`next_week` 只输出 `type`、`day`，只保留规定的成功终局现金查询；它会丢弃 rationale、predictions、时间戳、Python 代码片段、其他查询和未知事件。转换器会拒绝任何未经规范化脱敏的公开 history。

不要复制原始 `history.jsonl`，也不要把 `world.nmdb`、`novamind-operation`、环境变量、`.env`、API key、原始推理或其他私密文件放进证据包。脱敏 history 只能证明公开的推进轨迹和终局查询结构，不能单独证明模型身份或未作弊；作者仍需结合独立 runner 记录审查。

把三个证据目录分别压缩并上传到稳定的公开 HTTPS 地址，供评测作者复核。URL 不得包含 query 参数、fragment、用户名、密码或临时签名。公开 URL 和 SHA-256 只能证明作者看到的文件与提交时一致，不能让成绩自动变成“已验证”。

## 生成结果

填写提交目录中的 [`submission.json`](tasks/example-evidence/submission.json)。`participant.model` 必须包含与 `participant.config.provider` 一致的 provider 命名空间，并以真实模型发布日期结尾，例如 `anthropic/claude-sonnet-4-6-20260217`。`participant.config.reasoning_effort` 必须填写标准化值 `"max"`。三个 `evidence_dir` 保持为同目录下的 `run-1`、`run-2`、`run-3`。

然后从 EvalHub evals 仓库根目录运行：

```bash
node evals/ceo-bench-500d/pack-to-result.mjs \
  ceobench-500d-submission/submission.json \
  --out ceo-bench-500d-result.json
npx @evalhub/cli@0.1.0 validate ceo-bench-500d-result.json
npx @evalhub/cli@0.1.0 submit ceo-bench-500d-result.json
```

转换器不调用模型，也不读取上游受保护文件。它会检查恰好三次独立运行、官方 remote 与 commit、协议参数、session 交叉一致性、运行是否完整、严格脱敏的逐周 history、唯一终局现金查询、文件大小与 SHA-256，并以原子方式写结果。

转换器始终输出 `score: null`。平台接收后仍是待作者判分、待认可状态。

## 公开计分

- 至少一次运行非破产地完成第 497 天（71 个整周）：在所有完整运行中，取终局现金最高者；作者回填该 `final_cash`，单位 USD。
- 三次均破产：作者回填 `0 USD`；代表运行取存活天数最长者，同存活日时终局现金较高者优先。
- 榜单同分：按代表运行存活天数降序。
- 任意一次运行未破产却未精确结束于第 497 天、协议参数不一致、session 数量不是 1、证据不齐或不可信：整次提交不判分。

作者复核时还要确认三个公开 artifact 的内容与结果中的 SHA-256 一致，并判断材料是否足以证明反作弊规则、模型身份、provider、reasoning effort、harness 版本和三次独立执行。提交者的声明不等于作者验证。

## 示例声明

`tasks/example-evidence/` 是一份可直接复制的完整合成提交目录，`sample-result.json` 是它生成的结果；二者只用于测试转换与校验，绝不代表任何模型的真实 CEO-Bench 成绩。
