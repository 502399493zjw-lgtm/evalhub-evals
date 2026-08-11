# 题目与结论清单

`eval.yaml` 存放全部 31 个稳定任务 ID，以及从固定上游
`data/real_world_bench.json` 逐字复制的完整 `confirmed_task` 文本。`prompt` 保留来源英文
任务陈述以维持固定协议，`translation` 提供中文阅读版本；`run_spec` 说明外部工作流边界，
但不会改变来源提示词。

| 任务 ID | 中文题目 | 来源等级 | 站点模式 |
| --- | --- | --- | --- |
| `rwb-x-openai-7d-01` | OpenAI X 近 7 天互动表现 | 高 | 单站 |
| `rwb-openai-careers-apply-01` | 申请 OpenAI 旧金山云基础设施岗 | 高 | 多站 |
| `rwb-redfin-mortgage-01` | Redfin 奥斯汀房贷月供估算 | 高 | 单站 |
| `rwb-expedia-flight-01` | Expedia 纽约至迈阿密机票 | 高 | 单站 |
| `rwb-hn-top10-01` | Hacker News 前十热门帖概览 | 低 | 单站 |
| `rwb-imdb-scifi-01` | IMDb 近年高分科幻电影 | 中 | 单站 |
| `rwb-calcnet-mortgage-01` | Calculator.net 房贷成本测算 | 中 | 单站 |
| `rwb-cars-payment-01` | Cars.com 凯美瑞月供估算 | 高 | 单站 |
| `rwb-yahoo-stocks-01` | Yahoo Finance 五股观察列表 | 低 | 单站 |
| `rwb-yelp-opentable-01` | Yelp/OpenTable 芝加哥纪念日晚餐 | 高 | 多站 |
| `rwb-reddit-greenhouse-01` | Reddit 美国远程工程师申请 | 中 | 单站 |
| `rwb-reddit-pf-indexfund-01` | Reddit 指数基金热门帖子 | 低 | 单站 |
| `rwb-github-trending-py-01` | GitHub 本周热门 Python 项目 | 低 | 单站 |
| `rwb-bankrate-compound-01` | Bankrate 复利储蓄与 CryptPad 表格 | 高 | 多站 |
| `rwb-metacritic-actionrpg-01` | Metacritic PS5 与 PC 动作 RPG 对比 | 中 | 单站 |
| `rwb-stockanalysis-tech-01` | StockAnalysis 科技股估值 | 低 | 单站 |
| `rwb-zillow-greatschools-austin-01` | Zillow/GreatSchools 奥斯汀房源筛选 | 中 | 多站 |
| `rwb-xe-irs-reimbursement-01` | XE/IRS 差旅报销数据核对 | 低 | 多站 |
| `rwb-youtube-finance-channel-01` | YouTube 个人理财频道内容调研 | 中 | 单站 |
| `rwb-amazon-bottle-leaks-01` | Amazon 不锈钢水瓶漏水评价 | 中 | 单站 |
| `rwb-houzz-homedepot-backsplash-01` | Houzz/Home Depot 厨房防溅板选材 | 中 | 多站 |
| `rwb-google-flights-booking-miami-01` | Google Flights/Booking 迈阿密周末行程 | 中 | 多站 |
| `rwb-courtlistener-sec-helix-01` | CourtListener/SEC Helix 诉讼尽调档案 | 中 | 多站 |
| `rwb-scratch-apple-dash-01` | Scratch《Apple Dash》游戏 | 中 | 单站 |
| `rwb-2048-reach-256-01` | Classic 2048 达成 256 | 中 | 单站 |
| `rwb-song-maker-mirror-loop-01` | Chrome Song Maker 镜像循环 | 高 | 单站 |
| `rwb-census-sba-qcew-naics541511-01` | Census/SBA/QCEW 市场规模测算 | 中 | 多站 |
| `rwb-webflow-squarespace-wix-01` | Webflow/Squarespace/Wix 落地页审查 | 中 | 多站 |
| `rwb-nist-cisa-nvd-readiness-01` | NIST/CISA/NVD 网络安全就绪度 | 中 | 多站 |
| `rwb-bls-census-retail-metros-01` | BLS/Census 零售都会区排序 | 中 | 多站 |
| `rwb-lumen-ticket-rush-01` | Lumen Tickets 抢票 | 高 | 单站 |

## 输入清单

上游运行经判定后，把 JSON 清单交给 `pack-to-result.mjs`。清单的顶层字段必须恰好如下：

```json
{
  "manifest_version": 1,
  "eval_id": "ego-browser-real-world-bench",
  "protocol_revision": 1,
  "upstream_commit": "f566ac293e4e6bd80c4e9b062b5699f04eac41f4",
  "participant": {
    "model": "your-agent-model-id",
    "harness": "your-harness",
    "harness_version": "your-harness-version"
  },
  "run_date": "YYYY-MM-DD",
  "tasks": [
    { "task_id": "rwb-x-openai-7d-01", "all_rubrics_passed": true }
  ]
}
```

`tasks` 数组必须为每个已配置任务 ID 提供且只提供一个布尔结论。它不得包含未知任务、重复任务、
部分量规分数或用户自定义分母。示例文件仅为展示结构而把全部 31 条记录设为 `false`，它不是运行产物。

上游来源为一道任务声明了附件，为另一道任务声明了本地站点；这两类资源均未复制到本投稿中。请仅在
自己的上游运行环境中获取并审阅来源提供的资源。
