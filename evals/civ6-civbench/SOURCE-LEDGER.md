# 一手来源台账

评测类型：`upstream_publication`。比较边界固定为作者仓库 commit
`dd2019056371b92ea4854e879ddf05a8cad95e8a`，检索与人工核对日期为 2026-08-09。

| 事实或材料 | 一手来源 | 固定版本 / SHA-256 | 映射字段 | 许可与边界 |
| --- | --- | --- | --- | --- |
| civ6-mcp 让 MCP Agent 通过文字状态与工具玩完整《文明 VI》，README 列出 76 个工具和运行要求 | [作者 README](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/README.md) | `7ff7b96605f3e56fded5572c4f66c4ad24c3c6d89379ec1b2d997a382fa63a82` | description、summary、key facts、requirements | MIT 仓库文档；只转录必要事实，不复制游戏素材 |
| 仓库许可证与 Liam Wilkinson 版权声明 | [LICENSE](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/LICENSE) | `5bab5302ba7c946a9ffd6d0e7c9d2056acf93f9838babbda4a88fff724ecd072` | README 来源与授权 | MIT；保留归属和许可证链接 |
| 标准赛道使用完整 AGENTS.md，固定 react() Agent、禁止 run_lua、三个 Sample、默认 48 小时上限 | [evals/civbench.py](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/evals/civbench.py) | `ffd84d0bad3e255e022cdcedc65e0f0e195971a2a2bfad7bdc32f2ac7dd23073` | runner、run_spec、method steps、key facts | MIT 代码；EvalHub 不执行游戏部分 |
| 标准系统提示直接读取根目录 AGENTS.md；用户消息由 build_scenario_prompt 生成 | [evals/prompts.py](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/evals/prompts.py) | `7787a608e026b61cb5b81ca3d04774583fb40bb40c6d91bbedec26aa482cf1ae` | tasks[].prompt、run_spec | 三条完整题面由该函数和 Scenario 值确定性生成，未加入 EvalHub 文案 |
| 三个场景的名称、存档、330 回合、难度、地图、文明、对手、目标和盲点 | [evals/scenarios.py](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/evals/scenarios.py) | `a2382506933df1a6b805befec91c9fa209cf9396b655e1560a25c243404c2777` | tasks、overview table、run_spec | MIT 代码；不复制存档 |
| 标准赛道完整战略手册 | [AGENTS.md](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/AGENTS.md) | `40c32a6e35563029c0fb14cd07de77c9dbf006606646d07b1e25080742a09ce0` | run_spec 固定系统提示 | MIT 仓库文档；只引用固定文件，不在本目录再分发全文 |
| 通用 scorer 输出九个维度，含游戏内分数、产出增长、动作计数、工具错误率和已玩回合 | [evals/scorer.py](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/evals/scorer.py) | `d7978e30b9520fb62c5b491934b6916b9143a9f2f857bdd43f0012bc4d522b7b` | 清单 metrics、辅助视图、caveat | 原样保留字段语义；不把动作代理当主分 |
| 三场专属指标及其提取算法 | [evals/metrics.py](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/evals/metrics.py) | `d54781e2e8ce458be2e836c98d788e9d9482b093561cb5a8f7e00bb154c16229` | 清单场景 metrics、辅助视图 | MIT 代码；转换器固定允许的指标名与场景归属 |
| 三个场景的读者版配置、设计目的与关键指标 | [官方 benchmark 文档](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/web/content/docs/benchmarks.mdx) | `4535ab4106ebf67f5d63b95ce4dfc95622154bd90a5184441db7a20444f261cf` | overview table、detail profile、resources | MIT 仓库文档；表格只转录协议事实 |
| 存档文件名、游戏配置、正版运行要求与安装位置 | [evals/saves/README.md](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/evals/saves/README.md) | `00851a7617fc32b76e2dc46b4234fcd54697b9e5d4687d20e685da9462a888b3` | run_spec、assets/README、requirements | 不把 `.Civ6Save` 搬进 EvalHub；参赛方从固定作者仓库取得 |
| 作者网页的 ELO 采用多人自由混战的成对更新，基础 1500、K=32，并依赖全部完成对局的处理顺序 | [web/src/lib/elo.ts](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/web/src/lib/elo.ts) | `af4a1b105a8cd28df05c7b8c7e30470f481829c7c22999d5d21956c6ae438884` | scoring note、score interpretation、caveat | ELO 不可直接变成单份提交的独立主分，因此明确省略 |
| 作者官方 CivBench 页面 | [civ6-mcp.lwilko.com/civbench](https://civ6-mcp.lwilko.com/civbench) | 动态网页，2026-08-09 核对 | references、resources | 只链接，不抓取或再分发网页资产；动态结果不写入本版本基线 |
| 作者对多模型试玩的先导文章，并明确提示样本不足以稳定排名 | [I Gave an AI a Civilization](https://www.lwilko.com/blog/i-gave-an-ai-a-civilization) | 2026-06-22 发布，2026-08-09 核对 | resources、基线边界 | 只引用文章定位，不复制图片或把先导局改写为正式 CivBench 成绩 |

## EvalHub 适配决策

上游没有发布一个能直接放进单份 EvalHub 结果信封的独立总分：网页 ELO 依赖整个对局池，
`civbench_scorer` 的 `overall_score` 是游戏内分数且与胜负并不等价。为让三个固定场景能产生
稳定、透明、可单独验证的主分，本条目定义：

```text
三场胜率 = victory_count / 3 × 100
```

这项公式在 `eval.yaml`、README、runner、结果 detail 和辅助结局表中都明确标成
`Derived` / “懂模帝适配指标”，没有称作上游官方排序。改变场景、胜利判定、分母、舍入、
标准赛道或同分语义都必须提升 `protocol_revision`。

## 未映射内容

- 不导入作者网页的动态 ELO 或零散历史对局。
- 不把 `docs/devlog/` 的历史游戏当成三个固定场景的官方基线。
- 不复制 `.Civ6Save`、游戏二进制、截图、Logo、网站图片或博客插图。
- 不制造模型输出、逐回合轨迹、曲线、费用、token 或墙钟数据。
- 本版本没有 `published-results/`；详情页榜单在真实、经审核提交出现前保持空态。
