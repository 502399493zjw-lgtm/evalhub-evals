# 题目与外部提交清单

本评测是 `runner: custom`、`custom_mode: external_workflow`。懂模帝容器不会启动
《文明 VI》、FireTuner 或模型；参赛者先在自己的真实游戏环境中跑完三场，再把运行事实写进
一份 JSON 清单。转换器只做严格校验、算术聚合和结果信封封装：

```text
node evals/civ6-civbench/pack-to-result.mjs <submission.json> --out <result.json>
```

## 固定运行边界

- 上游：`lmwilki/civ6-mcp@dd2019056371b92ea4854e879ddf05a8cad95e8a`
- 赛道：`civbench_standard`
- 系统提示：钉死 commit 根目录的完整 `AGENTS.md`
- Agent：上游 `evals/civbench.py` 中固定的 `react()` 配置
- 游戏：合法授权的 Steam《文明 VI》与 Gathering Storm，FireTuner 已启用
- 场景：`ground-control`、`snowflake`、`cry-havoc` 各一次
- 起点：对应作者提供的 T1 存档；Quick 速度；每场最多 330 回合
- 结局：`victory`、`defeat`、`turn-limit` 或 `failed`，全部必须保留

`eval.yaml` 的三条 `prompt` 是上游 `build_scenario_prompt()` 在未恢复旧存档时生成的完整用户
消息，逐字对应钉死 commit。EvalHub 自己增加的运行与证据规则只写在 `run_spec` 和本文件，
没有混进上游题面。

## 清单顶层字段

- `manifest_version`：只接受 `1`
- `eval_id`：必须是 `civ6-civbench`
- `protocol_revision`：必须是 `1`
- `upstream_commit`：必须是上面的完整 40 位 commit
- `track`：必须是 `civbench_standard`
- `participant.model`：实际调用的基础模型 ID
- `participant.harness` 与 `participant.harness_version`：实际承载 Agent 的产品或编排器及版本；
  例如 Codex、Claude Code、Gemini CLI 或自建 Inspect 入口，不能把它拼进 model
- `run_date`：真实存在的 `YYYY-MM-DD` 日期
- `scenarios`：恰好三条，三个固定 `task_id` 各一次且 `run_id` 不重复

## 每场字段

- `task_id`、`run_id`
- `outcome.result`：`victory` / `defeat` / `turn-limit` / `failed`
- `outcome.winner_civilization`、`winner_leader`、`victory_type`：胜负已产生时三项全部填写；
  到达上限或运行失败时三项全部为 `null`
- `victory` 的赢家必须是该场景的参赛文明与领袖（Babylon/Hammurabi、Korea/Seondeok 或
  Sumeria/Gilgamesh）；`defeat` 的赢家必须是对手
- `terminal_turn`：0–330；除了 `failed` 以外至少为 1
- `metrics`：从上游 `civbench_scorer` 的 Score.value 转录。正常、败局或回合到限时必须完整；
  `failed` 时必须为 `null`；其中 `turns_played` 与 `terminal_turn` 最多相差 1
- `evidence`：Inspect `.eval`、telemetry `manifest.json`、diary 与 log 的小写 SHA-256。
  `failed` 场景允许前三项为 `null`，但必须提供失败日志摘要

转换器拒绝未知字段、场景缺失、重复 run ID、重复证据摘要、非法日期、超出上游范围的指标，
也拒绝提交方覆盖场景数量、分母或计分规则。它不会联网读取证据内容，所以转换成功不等于成绩
已经获认可；`scored_by: author` 要求作者再核对原始文件是否属于同一真实运行、结局是否与日志
一致，以及模型和 harness 身份是否准确。

## 指标字段

三场正常输出都必须包含九个上游通用指标：

`overall_score`、`economic`、`military`、`scientific`、`cultural`、`spatial`、
`diplomatic`、`tool_fluency`、`turns_played`。

场景专属指标必须完整对应 `evals/metrics.py`：

| task_id | 专属指标 |
| --- | --- |
| `ground-control` | `victory_check_freq`、`victory_check_count`、`great_people_check_count`、`spaceport_turn`、`space_project_count` |
| `snowflake` | `cities_t50`、`cities_t100`、`cities_t150`、`cities_t200`、`map_scan_freq`、`map_scan_count`、`victory_check_count`、`seowon_count`、`military_unit_count`、`exploration_pct` |
| `cry-havoc` | `first_attack_turn`、`war_carts_by_t25`、`ziggurat_count`、`military_in_first_5_builds`、`cities_captured_by_t40` |

## 主分数

```text
score = round((victory_count / 3) * 100, 6)
```

只有 `victory` 计 1；`defeat`、`turn-limit` 和 `failed` 都计 0。三场不能删减，失败后也不能通过
省略该场来改变分母。最终只有主分参与排名；结局表、上游通用指标和场景专属指标均为辅助展示。

这是懂模帝为独立结果信封定义的透明适配指标，不是 CivBench 官方 ELO。相同胜场数直接并列，
不拿游戏内分数、终局回合、token、费用或墙钟耗时破同分。

## 结构示例

`example-submission.json` 是合成结构样例：模型名、harness、结局、回合和指标全部为了覆盖
`victory`、`defeat`、`turn-limit` 三种分支而虚构；十二个摘要分别是对可公开复算的
`<scenario> <artifact> synthetic` 字符串求 SHA-256。它不对应任何真实模型、上游正式成绩或
EvalHub 复跑。`sample-result.json` 只是把这份结构样例交给转换器得到的输出。
