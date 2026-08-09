# CivBench（文明 VI 长程战略 Agent）

CivBench 把真实《文明 VI》变成一个长程 Agent 环境。模型不是回答一段静态题目，而是通过
civ6-mcp 的文字状态和工具调用连续管理单位、城市、科技、市政、经济、外交与战争，直到赢得
游戏、被对手击败、达到回合预算或运行失败。

本条目固定作者仓库 commit `dd2019056371b92ea4854e879ddf05a8cad95e8a` 的
`civbench_standard` 赛道。所有参赛模型使用同一份完整 `AGENTS.md` 系统提示、同一个 Inspect
`react()` Agent 和三个固定 T1 存档；变化项只有基础模型以及如实申报的 harness。

## 三个固定场景

| 场景 | 文明 | 地图 | 难度 | 胜利条件 | 主要盲点 |
| --- | --- | --- | --- | --- | --- |
| Ground Control | Babylon (Hammurabi) | Pangaea, Standard | Prince | 全部启用 | 能否持续监控自认为领先的竞赛 |
| Snowflake | Korea (Seondeok) | Six-Armed Snowflake, Small | King | 仅征服胜利 | 默认科技路线被移除后能否重新理解工具用途 |
| Cry Havoc | Sumeria (Gilgamesh) | Pangaea, Tiny | Immortal | 全部启用 | 难度规则改变后能否放弃不再可行的默认开局 |

三场都使用 Quick 速度和 330 回合预算。完整上游题面逐字放在 `eval.yaml > tasks[].prompt`；
标准赛道、游戏环境、证据和清单约束放在各自 `run_spec` 与 `tasks/README.md`，不混入题面。

## 被计分的是什么

主分数是三场胜率：

```text
score = round((victory_count / 3) * 100, 6)
```

只有真实 `victory` 计 1，`defeat`、达到 330 回合仍未胜和不可恢复运行失败均计 0。三个场景
必须全部出现在提交清单里，不能删除输掉或失败的场景来缩小分母。最终分数只可能是
0、33.333333、66.666667 或 100；相同分数并列，不另设破同分指标。

这个主分是**懂模帝适配指标**，不是上游官方 ELO。作者网页把一批已完成对局按多人自由混战
结果重算 ELO；那个数依赖整个对局池，无法成为一份独立 EvalHub 结果信封中稳定的主分。
同样，上游 `civbench_scorer` 的游戏内分数、产出增长和动作计数会完整保留在辅助表格里，
但不改变胜负排名。

## 外部运行与封装

这不是能在 EvalHub runner 容器里直接启动的评测。完整运行需要：

- 合法授权的 Steam《文明 VI》与 Gathering Storm
- FireTuner 已启用，游戏监听 TCP 4318
- Python 3.12+、uv、Inspect AI 与 civ6-mcp
- 平台对应的游戏启动和存档加载环境
- 每场最多 330 回合；上游默认墙钟保护上限为 48 小时

参赛者在自己的环境按 `run_spec` 跑完三场，保存 Inspect `.eval`、telemetry manifest、diary
和 log，再按 `tasks/README.md` 写出提交清单。EvalHub 的锁定 runner 只执行：

```bash
node evals/civ6-civbench/pack-to-result.mjs <submission.json> --out <result.json>
```

转换器无网络、无模型调用、不读密钥或环境变量。它拒绝未知字段、场景缺失、重复 run ID、
重复证据摘要、越界指标、伪造的协议版本和提交方自定义分母；之后按固定公式生成结果信封，
再通过共享 `ResultFileSchema` 与本评测契约校验并原子写出。

转换器只能证明清单结构与算术合规，不能仅凭 SHA-256 证明一场游戏真的发生。这里使用
`scored_by: author`：提交数值后仍须由作者核对原始 Inspect 与 telemetry 证据、结局、固定存档、
模型和 harness 身份。`score_policy: required` 表示每次提交都必须先得到数值分数，不接受
等待作者补填的 `null`。

## 来源、授权与不背书声明

上游项目由 Liam Wilkinson 开发，作者仓库为
https://github.com/lmwilki/civ6-mcp ，本条目固定在 commit
`dd2019056371b92ea4854e879ddf05a8cad95e8a`。协议转录对应的文件、摘要与目标字段列在
`SOURCE-LEDGER.md`。

该 commit 的仓库代码和文档以 MIT License 发布，版权声明为 `Copyright (c) 2026 Liam
Wilkinson`。本目录保留上游归属、commit 和许可证链接；转录的三条题面来自 MIT 仓库中的
`evals/prompts.py` 与 `evals/scenarios.py`。本目录自身的转换器与说明随 EvalHub 仓库发布，
不改变上游材料的许可归属。

本条目不复制 `.Civ6Save`、游戏文件、游戏 Logo、截图、网站图片或博客插图。Civ6 存档由商业
游戏生成，参赛者从钉死的作者仓库取得运行所需文件，并自行负责正版游戏环境。对《文明 VI》、
Sid Meier、Firaxis、2K 或其商标的提及只用于识别运行环境，不表示这些权利方参与或背书。

本条目由 FrichXi 整理到 EvalHub，未经 Liam Wilkinson、Firaxis 或 2K 认证或背书，也不代表
上游作者的立场。

## 基线与证据边界

本版本不包含 `published-results/`。截至制作时，没有找到能按这三个固定场景、固定标准赛道和
本条目主分公式逐模型核验的完整官方结果，所以 `baseline_policy: optional`。以下内容都没有被
改写成榜单成绩：

- 作者网页的 ELO：依赖整个已完成对局池，不是单份结果的独立数值
- 作者文章中的先导实验：作者明确把它当作 pilot，而不是稳定模型排名
- 仓库 `docs/devlog/` 的历史游戏：不是三个固定 CivBench 场景的完整标准赛道复跑
- `sample-result.json`：只是合成清单通过转换器后的结构示例

如果上游以后发布完整、可核验且协议一致的官方结果，可在不改变主分语义时另行审查并增加
`upstream_author_publication` 信封；不得从文字总结、截图或零散局数推算缺失模型成绩。

## 已知限制

- 固定存档控制初始地图，但模型采样、游戏 AI、工具错误和恢复路径仍带来运行方差；每场一次
  运行没有跨种子置信区间。
- 三场胜率非常离散，适合回答“能否赢下不同战略条件”，不适合精细区分同为一胜或两胜的模型。
- 上游通用与场景指标含动作计数代理，能解释过程但不等于完整的战略质量判断。
- 真实运行成本高、时间长，并依赖商业游戏和本机 GUI；EvalHub 只托管协议、封装器与经审核结果。

## 目录

```text
evals/civ6-civbench/
├── AUTHORS
├── README.md
├── SOURCE-LEDGER.md
├── eval.yaml
├── pack-to-result.mjs
├── sample-result.json
├── assets/
│   └── README.md
└── tasks/
    ├── README.md
    └── example-submission.json
```

`sample-result.json` 与 `tasks/example-submission.json` 都是合成结构数据，不对应真实模型、
官方成绩或 EvalHub 独立复跑。
