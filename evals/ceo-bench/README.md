# CEO-Bench（500 天 SaaS 经营长跑）

这套评测问一件事：给你一家 AI SaaS 公司、100 万美元现金和 500 个模拟日，你的 Agent 能不能把
它经营下去——而且是在现金流意义上真的经营下去，不是答对一道题。

参赛主体是经营这家公司的 Agent。它接手 NovaMind AI（B2B/B2C 的 AI SaaS 公司），每周以一个
模拟周为单位推进，每周可以任意次调用 34 个业务工具、查询 19 张业务数据库表，然后自己决定
下周怎么过：套餐怎么定价、五个广告渠道分别投给哪些客群、促销给多少、算力买到哪一档、研发
投多少钱和立哪些项目、企业客户怎么一轮一轮谈价。每周还要交出本周决策理由和四个时间尺度的
现金预测。

现金余额就是分数。现金一旦为负，这次运行立刻结束（这是模拟器里唯一的破产触发条件）。

## 被计分的是什么

每个参赛 Agent 在钉死的上游模拟器里跑 3 次相互独立的运行，每次固定：

| 参数 | 值 | 备注 |
| --- | --- | --- |
| 模拟天数 | 500 | 上游 `run_test.py` 默认 3650，必须显式 `--days 500` |
| 初始现金 | 1,000,000 USD | `config.py` 默认值，不可覆盖 |
| 随机种子 | 42 | 显式 `--seed 42` |
| 场景 | default | 显式 `--scenario default` |

主成绩 = 三次运行中**最佳运行**的结束现金（USD）。"最佳"的定义与官方榜单一致：先比最长
存活天数，再比结束现金。三次全部破产时主成绩记 0，不拿负现金参与排名。同分时按
`eval.yaml` 声明的 tiebreak 先看存活天数。

这套评测刻意把经营长跑当成分数本身：2026-08-16 官方榜单快照里的 19 个模型，最佳运行现金从 $22,148,357 一路
铺到 $0（破产），方差很大——同分在同一次运行里也能差出数量级，所以官方口径选最佳运行而不选
平均，本评测沿用同一口径。

## 分数怎么读

现金不是单调向上的。官方给出的机制说明里有几层困难是写死的：

- **长时滞**：很多动作成本立刻发生，收益、留存、研发、声誉效果几周后才到，逼着 Agent 做
  长视界决策；
- **非平稳环境**：竞品事件会让客户期望不可逆上移，客群偏好漂移、宏观周期变化要求持续
  收集信息并适应；
- **信息不完全**：26 个客群里 20 个要先花钱做市场调研才能发现，企业客户 7 天不回复就
  永久流失。

官方规则基线（rule-based baseline，最优路径式）的最佳运行现金是 $15,756,408，官方估算的
"最终现金理论上界"是 $2,200,000,000——但 19 个模型里最好的也只做到 $22,148,357（Kimi K3）。
目前没有任何参赛模型接近理论上界，这正是这套评测想留出的空间。

## 本地怎么跑

本评测 `runner: custom`、`custom_mode: external_workflow`。模拟器需要 SQLCipher 数据库、
上游 Python 依赖和参赛 Agent 自己的模型调用，不可能在本仓库的无网络只读沙箱里跑起来，所以
实际运行发生在参赛方自己的基础设施上。

### 上游来源与固定版本

| 角色 | GitHub 来源 | 固定版本 | 用途 |
| --- | --- | --- | --- |
| 主模拟器与 canonical prompt | `zlab-princeton/ceobench-src` | `d2b7b32e5301a571b77f5f68bd1032adbcd5b464` | 本条目协议、机制、题面与现有官方成绩的比较边界 |
| coding-agent 运行入口 | `zlab-princeton/run-ceobench` | `885ae1d7d09b3effa08825ce7f03075224ebe373` | 公开的本地 CLI 复现路线；不替换本条目的题面或评分规则 |

`run-ceobench` 要求 Python 3.13+。在固定 commit 的检出目录内安装依赖并创建会话：

```bash
pip install -r requirements.txt
./novamind-operation new-session --days 500 --seed 42
```

`new-session` 会输出 `session_id`，后续命令默认使用最新会话。Agent 通过
`./novamind-operation status`、只读 SQL `query`、Python API、`history` 和 `next-week` 交互；
约 72 次 `next-week` 后用 ledger 查询结束现金。该上游任务只允许一次 `create-session`，并明确禁止
读取、解密、反汇编或调试 `world.nmdb` 与 `novamind-operation`。正式 EvalHub 口径仍要求三次独立
运行，因此要在三个互相隔离、各自合规的新任务实例中执行，再把三份证据汇总到提交清单；不能在
同一个上游任务实例里绕过一次会话限制。

输入是 Agent 对 CLI/API 的经营动作、每周理由，以及 1、4、12、26 周现金预测；运行输出是会话状态、
历史、ledger 和结束现金。本条目要求额外保存每次运行的存活天数、破产标志、结束现金、Agent 操作轮数
与去凭证证据包 SHA-256，具体字段见 `tasks/README.md`。

复现环境需要本机文件读写和子进程权限、Python/SQLCipher 依赖、模型提供商所需网络和凭证，以及足够
完成三次 500 天经营的时间、算力和费用。建议先审查固定版本并自行决定容器或虚拟机隔离。EvalHub
没有执行这两个第三方仓库，本次 readiness 的 runtime verification 是 `unverified`，静态检查也不构成
安全审计、兼容性证明或上游背书。

### 结果信封转换器

本仓库的转换器只把已经完成的三次运行清单换算成结果信封，不安装模拟器、不做模型调用、不联网、
不读环境变量：

```bash
node evals/ceo-bench/pack-to-result.mjs <submission.json> --out <result.json>
```

清单字段说明和一份可直接跑通的结构示例在 `tasks/README.md` 与
`tasks/example-submission.json`。转换器会拒绝清单里任何未列出的字段，强制上游模拟器本身的
终止语义（破产运行必须 `days_survived < 500` 且结束现金为负，完成运行必须 `days_survived
== 500` 且结束现金不为负），并在写出结果前用 `ResultFileSchema` 和本评测契约自校验一遍，
两道都过才落盘。

## 来源与边界

以下是中立事实陈述，请连同上面的评测说明一起读。

**上游出处。** 题面、模拟器、经济参数与客群配置全部来自 CEO-Bench 项目：

- 官方作者仓库 https://github.com/zlab-princeton/ceobench-src ，本条目钉死在 commit
  `d2b7b32e5301a571b77f5f68bd1032adbcd5b464`
- 公开 coding-agent 运行入口 https://github.com/zlab-princeton/run-ceobench ，复现说明钉死在 commit
  `885ae1d7d09b3effa08825ce7f03075224ebe373`
- 论文 arXiv:2606.18543（Haozhe Chen、Karthik Narasimhan、Zhuang Liu，cs.AI），v1
  2026-06-16、v2 2026-07-22
- 官方站点 https://ceobench.com
- 官方论文 PDF https://arxiv.org/pdf/2606.18543

`eval.yaml` 里 `tasks[0].prompt` 是上游
`src/saas_bench/agents/simulator_instructions.md` 在钉死 commit 上的逐字转录，
`{total_days}` / `{total_weeks}` / `{total_years}` 模板占位符原样保留未替换；`translation`
是中文对照译文；`run_spec` 是 EvalHub 为可复现补充的固定配置（500 天、seed 42、scenario
default、三次独立运行、证据包与去凭证要求），这些配置不在上游题面里。

**授权边界。** 上述两个上游代码仓库在钉死的 commit 上都**没有**放出独立的 LICENSE 文件，
GitHub API 也报告不到许可证；arXiv 论文页面标注 CC BY 4.0，但这一许可不能外推到代码仓库。
可观察到的授权信息就到这个程度，本条目因此按
最保守的方式处理：只转录运行协议所必需的提示词文本，一张官方机制图一律 HTTPS 引用官方原图
而不在本仓库转存副本（见 `assets/README.md`），不复制任何题目数据、轨迹、数据库或可执行产物。
被评的模拟世界由参赛方在钉死的上游 commit 上自行检出并运行。

**EvalHub 与上游没有官方关系。** 本条目是把上游已公开发表的协议与成绩整理进 EvalHub，
未经 zlab-princeton 或 CEO-Bench 作者官方认证或背书，也不代表上游作者的立场。

**published-results 里的成绩是上游发表值，不是 EvalHub 复跑。**
`published-results/official-leaderboard-2026-08-16.json` 对 ceobench.com 官方榜单的 19 个模型行做
完整覆盖：18 个能映射到 EvalHub 注册表的参赛条目放在 `results`，Grok 4.6 因暂无可确认的 canonical
model ID 放在 `source.omitted_models` 并标记 `unregistered`。来源页抓取日期和
`snapshot_sha256` 都记在信封里。成绩全部是 `upstream_author_publication`，不带 `usage`、
`task_results` 或 `showcases`，因为 EvalHub 没有独立跑过这些运行，没有逐题结果可展示。

三点需要明确标注的边界：

1. 榜单页有两个非参赛参照行：Rule-based baseline（$15,756,408）与 Estimated final cash
   upper bound（$2,200,000,000）。它们不是模型，不进入 `results`，只在
   `official-run-statistics` 视图的表格注里作为官方参照项说明保留。
2. 官方站点把 "Gemini 3 Flash" 展示为 Gemini 3 Flash，其模型 API 标识是
   `google/gemini-3-flash-preview`，本条目用注册表可解析的 canonical id 收录，并在每条
   `detail` 里披露站点展示名与映射关系；Grok 4.6 则因无法确认注册表映射而显式遗漏，不猜测 ID。
3. 现金曲线图、客群分布图等由官网前端脚本渲染（`assets/figures/*.html`），没有可引用的
   静态数据，因此本条目没有收录任何 `line_chart`，也没有据表格推算出任何曲线。

**sample-result.json 只是结构示例。** 它是把 `tasks/example-submission.json` 喂给转换器
得到的输出，participant 是刻意造的 `example/synthetic-ceo-agent`，三次运行的现金数值是为
演示算分而选的示例数，不来自任何来源、不对应任何模型，也不是官方成绩或 EvalHub 复跑。

## 目录内容

```text
evals/ceo-bench/
├── AUTHORS                                  投稿人 GitHub handle
├── README.md                                本文件
├── eval.yaml                                评测定义、detail_profile、逐字题面与译文
├── pack-to-result.mjs                       自定义转换器（无网络、无进程、无环境变量）
├── sample-result.json                       结果信封的结构示例
├── assets/README.md                         官方机制图的引用方式与授权说明
├── tasks/
│   ├── README.md                            提交清单字段说明
│   └── example-submission.json              可跑通的结构示例清单
└── published-results/
    └── official-leaderboard-2026-08-16.json 官方榜单 19 行的覆盖（18 个结果 + 1 个显式遗漏）
```
