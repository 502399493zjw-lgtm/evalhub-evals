# 一手来源台账

本目录以评测作者提供的本地新版 `/Users/xixiangyu/dev/zangai-bench-v2` 为协议源，以作者发布站点为成绩源。一个月前的公开 GitHub 仓库只记录历史项目，不定义本次题面或评分。

| 来源 | 固定版本或摘要 | 可映射事实 | 映射位置 | 边界 |
| --- | --- | --- | --- | --- |
| 作者本地新版 `tasks/graph-engineering-v2/prompt.locked.txt` | sha256 `cd7c9074d60e342fd877f70253444dc0fe278897fc6e20715800e67a336eef9c` | 完整题面、交互要求、`data-bench` 验收契约 | `eval.yaml` 的 `tasks[0].prompt` | 本次投稿的题面权威源 |
| 作者本地新版 `tasks/graph-engineering-v2/inputs/data/graph.json` | sha256 `f83313f6e50b2f1bb809c9c1fc0de2217c437e33b1fa417b571b6527b7df988e` | 649 节点、1699 条关系、4 类节点、16 类关系 | `tasks/graph.json`、详情页事实卡 | 由投稿作者随本目录分发 |
| 作者本地新版 `scorers/score-graph-engineering-v2.cjs` | sha256 `6f773714090a5a1da48d15fb493f0d7dd08aa6d5a6b8944988846cee3b115828`；scorer 3.1 | 11 项百分制权重、失败记零和惩罚规则 | `eval.yaml` 评分说明、README | 浏览器评分器不放进 EvalHub 沙箱；由作者外部执行与复核 |
| 作者本地新版 `DESIGN.md`、`PLAN.md` | OpenCode 1.17.9；Playwright 1.61.1；10 轮 | 统一 harness、浏览器版本、轮数与平均方式 | `eval.yaml`、转换器协议 | 本地文件不是公共旧仓库；其固定事实已写进本目录 |
| [葬AI Benchmark 当前榜单](https://funeralai.cc/test/) | release `web4-graph-v2-leaderboard-20260804-v2`；2026-08-09 获取；HTML sha256 `957c69c46857f19325feecb51244e5fa16401d838e575510854adec93f1a388d` | 16 个模型的最终均分、中位数、用时、调用、成本与性价比 | `published-results/official-web4-graph-v2-2026-08-04.json` | 只转录最终 release 汇总；不展示逐轮或其他批次信息；不是 EvalHub 独立复跑 |
| [当前方法说明](https://funeralai.cc/test/methodology/) | 2026-08-09 获取；HTML sha256 `e42d4f4213eb8d14c33e548caecca6c9cff5b33cc805cbfa2354a20aee60d34d` | 11 项权重、10 轮口径、失败记零、成本与性价比边界 | `eval.yaml` 方法、局限和评分表 | 只转录页面明确发布的信息 |
| [历史公开框架仓库](https://github.com/FrichXi/personal-work-benchmark) | 公开仓库当前版本早于本题 | 项目历史与作者归属 | README 的历史说明 | 不用于定义本次题面、数据、评分器或运行版本 |
| [libtv.md 葬AI Logo](https://libtv.md/assets/logo-zangai-text.png) | sha256 `e3bf841329f81c1f4b269f930299306cbc9a614a030049ba5e9369ad65a02086` | 作者权威透明文字 Logo | `detail_profile.figures[zangai-logo]` | 与工作区权威 `素材/logo.png` 字节一致；仅用 logo-only 模式 |

## 许可与署名

新版题面、图数据与协议由 GitHub 用户 `FrichXi` 作为作者投稿，`AUTHORS` 与投稿身份一致。历史公开框架仓库为 MIT，但其许可不被冒充为新版目录的上游版本证明；本目录只分发作者明确要求上传的新题数据与本投稿原创的适配文件。
