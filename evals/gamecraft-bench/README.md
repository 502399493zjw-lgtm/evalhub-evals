# GameCraft-Bench（真实引擎里的端到端做游戏）

考察 Agent 能不能把一段自然语言游戏需求，做成一个在 Godot 4 里真能跑起来的完整 2D 游戏。
140 道题覆盖 15 个游戏族，每题都要交出可启动的工程外加自己写的确定性输入轨迹。
判分不看代码，只看游戏被真人式操作时屏幕上发生了什么。

- 主分数：140 题各自 `[0,1]` 得分的等权平均 × 100，单位「分」，越高越好，理论上限 100。
- 交互形态：`agent`；运行方式：`custom` + `custom_mode: external_workflow`。
- 判分：`scoring: custom`；参赛方按上游 verifier 完成取证与判分，`scored_by: author` 负责核对成绩。
- `score_policy: required`、`baseline_policy: required`。

## 来源与固定边界

本目录是对外部评测的接入，协议与成绩均来自上游作者发表物，不是 EvalHub 独立复跑，
EvalHub 也未获得上游认证或背书。

| 项目 | 值 |
| --- | --- |
| 官方作者仓库 | <https://github.com/FreedomIntelligence/gamecraft-bench> |
| 固定 commit | `7385d326fb25ba9af8b353615987bf680a25b657`（2026-08-10T02:34:02Z） |
| 论文 | arXiv:2606.17861v1（2026-06-16 提交，cs.CL，CC BY 4.0） |
| 官方项目页 | <https://tongxuluo.github.io/gamecraft-bench-website/> |
| 官方 README 快照 | `README.md` 于固定 commit 的内容为 13,446 字节，sha256 `79a8602b951820509d1613fb7d468a80317d1f4f312e51fcd1695aad94432bfa` |
| 官网快照 | 2026-08-10 取回，77,123 字节，sha256 `c4b823a7440574a7eae53746742dc5119dd4f2493809982a490de89f913cf168` |
| 论文快照 | `https://arxiv.org/html/2606.17861v1`，2026-08-10 取回，sha256 见 `published-results/paper-table6-2026-06-16.json` |

上游仓库没有 tag 也没有 release，因此唯一可靠的版本锚点是上面的 commit SHA。

## 任务与交付物

每题给出一份散文式需求（`instruction.md`：核心愿景、玩家会经历什么，以及统一的交付格式说明），
一个 Godot 工作区，以及两个只读挂载的 2D 资产库。Agent 必须交出：

1. `/workspace/game/` 下完整可启动的 Godot 4 工程；
2. `/workspace/game/demo_outputs/` 下 1–10 个确定性输入轨迹 JSON，
   每个含 `duration_frames`（≤600，即 30 fps 下 20 秒）与按帧排序的事件序列，
   事件类型为 `mouse_click` / `mouse_down` / `mouse_up` / `mouse_move` /
   `key_press` / `key_down` / `key_up` / `wait`，坐标按 1280×720 视口。

需要特定局面的演示要实现 `-- --scenario <id>` 入口：跳过菜单、确定性构造该状态、立即接受输入。

`eval.yaml` 的 140 个 `tasks[]` 条目，其 `prompt` 是上述 `instruction.md` 在固定 commit 上的
**逐字符原文转录**（已用程序逐题比对，140/140 与来源逐字节一致），未做任何摘要或截断。
EvalHub 自己补充的运行约定放在不渲染的 `run_spec` 里。

上游只发布英文题面，因此 `translation` 只在有可靠中文译文时才填。当前为 5 道代表题提供了
完整中文译文（`platformer-cozy-harbor-delivery`、`roguelike-dice-throne`、`visualnovel-keepsake`、
`shooter-void-patrol`、`idle-spell-tower`）：逐节对照英文原文翻译，保留全部 Markdown 结构与代码块，
路径、命令、字段名与 keycode 一律不译，并经独立复核确认无缺节、无截断、无自行添加的内容。
其余 135 道题的 `translation` 留空，详情页显示真实空态——不用机翻或概括冒充译文。
译文数量还受一个硬约束：`pr-policy` 必须通过 GitHub Contents API 读到 `eval.yaml` 全文，
而该 API 对超过 1 MiB 的文件返回空内容，本文件已达 1,026,490 字节。

任务族分布（不含 `example` 模板题；仓库实有 141 个任务目录，减去 `example` 恰为 140，
与 README 家族表、论文 Table 3 及官网 Task Suite 逐族一致，官网明写 "Counts exclude the example task"）：

Platformer 19、Strategy 17、Tycoon 16、Open-world 15、Roguelike 14、Visual novel 11、
Puzzle 8、Shooter 7、Simulation 6、Card game 5、Horror 5、Rhythm 5、Idle 4、Racing 4、Sports 4。

## 判分口径（以上游代码为准）

单题判分链路完全由 `gamecraft_bench/verifier/` 决定：

1. **启动闸门**：在 shell 里跑 `godot --headless --path /workspace/game --quit-after 5`，
   退出码 0 则 `BUILD=1`，否则 `BUILD=0`。`BUILD=0` 时验分器**跳过回放与判分**，该题得 0 分。
2. **回放取证**：按文件名取前 10 个轨迹，逐个在 Xvfb 虚拟屏上重启游戏，
   用 xdotool 注入合成鼠标键盘事件，ffmpeg 录制 1280×720 并压到 854×480，每 0.5 秒抽一帧；
   超过 20 秒的录像按 `demo_id` 确定性随机取一个 20 秒连续窗口。
3. **多模态裁判**：每个 demo 调用一次，一次性给出该题全部 requirement 的 0–1 分
   （0 未演示、0.5 部分演示、1 清晰演示）；最多尝试 5 次（首次加 4 次重试），仍失败则该 demo 全部条目记 0。
4. **聚合**：每条 requirement 先跨 demo 聚合（`agg=max` 取最大值、`agg=mean` 取均值，无 demo 记 0），
   再按该题 `score_formula` 合成：`BUILD × (四类各自 requirement 等权均值，按类权重加权)`，裁剪到 `[0,1]`。

四类为 `Core Mechanics`、`Content Depth`、`Functional Visuals`、`Presentation & Art`
（论文与 README 的展示名把第四类写作 Art and Presentation）。
全库共 2305 条 requirement，每题 12–21 条。

类权重经逐题解析 140 份 `rubric.json` 求得：**135 题等价于 0.15 / 0.35 / 0.15 / 0.35**，
**5 道视觉小说题**（`visualnovel-arcaneacademy`、`visualnovel-grimfable`、`visualnovel-keepsake`、
`visualnovel-lastsignal`、`visualnovel-pactbound`）**为 0.20 / 0.30 / 0.15 / 0.35**；
140/140 权重之和恒为 1.0，且 `BUILD=0` 时恒归零（均已用 AST 求值逐题验证）。
其中 132 题直接用十进制系数，`openworld-fishing` 只改变了括号写法，另有两题
（`strategy-ant-colony`、`strategy-spell-tactics`）把标准权重写成 `3/7/3/7 ÷ 20`，
都与 0.15/0.35/0.15/0.35 完全等价。

榜单总分为 140 题得分的等权平均 × 100。需要说明的是，上游没有任何一句话把这个聚合写成公式：
论文只说 "Table 4 reports benchmark-level scores in percentage points"，官网只说
"Overall and category scores on the full 140-task benchmark"，
仓库里唯一的跨题聚合代码是 dashboard 的 `avg()`；`× 100` 的换算不在仓库代码内。
本目录采用「等权平均 × 100」这一读法，并在此如实记录它是由代码与表述综合得出的口径。

`rubric.json` 放在 `/tests/`，Agent 解题阶段拿不到其内容（140 份 `instruction.md` 全都不含
rubric 条目或权重字面量），属于隐藏评分细则。

## 官方成绩

`published-results/` 下两份信封，来源刻意分开，均为 `upstream_author_publication`，
不含 `usage` / `task_results` / `showcases`：

### `official-leaderboard-2026-08-10.json`

官方项目页榜单，2026-08-10 快照收录 12 行中的 9 行。榜单原文（HTML 逐格解析，与仓库 README 主结果表逐格一致）：

| Rank | Agent | Model（上游原文） | Date | Overall | Mechanics | Depth | Visuals | Art | 是否收录 |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Claude Code | Fable 5 high | 2026-07-20 | 65.72 | 76.52 | 58.61 | 66.93 | 67.68 | 收录 |
| 2 | Codex | GPT-5.6-sol high | 2026-07-17 | 60.50 | 74.50 | 56.10 | 64.80 | 57.00 | 收录 |
| 3 | Kimi Code | Kimi-K3 | 2026-08-05 | 56.96 | 73.03 | 53.38 | 56.90 | 53.59 | 收录 |
| 4 | SeeleAgent | Seele02-pro | 2026-07-15 | 50.70 | 68.42 | 48.76 | 52.74 | 44.17 | **未收录** |
| 5 | Claude Code | Opus-4.7 high | 2026-06-16 | 41.46 | 55.34 | 39.48 | 42.78 | 36.86 | 收录 |
| 6 | Codex | GPT-5.5 high | 2026-06-16 | 39.49 | 54.36 | 38.61 | 41.84 | 32.94 | 收录 |
| 7 | Claude Code | Deepseek-V4-Flash-0731 | 2026-08-10 | 30.66 | 40.55 | 27.56 | 32.21 | 28.81 | **未收录** |
| 8 | Kimi Code | Kimi-K2.6 | 2026-06-16 | 30.65 | 39.76 | 28.07 | 33.66 | 27.99 | 收录 |
| 9 | Claude Code | MiMo-V2.5-Pro | 2026-06-16 | 24.10 | 32.33 | 22.59 | 27.45 | 20.65 | 收录 |
| 10 | Code Buddy | GLM-5.1 | 2026-06-16 | 18.29 | 25.23 | 17.80 | 21.14 | 14.59 | 收录 |
| 11 | Code Buddy | MiniMax-M2.7 | 2026-06-16 | 10.95 | 14.27 | 9.92 | 14.92 | 8.85 | **未收录** |
| 12 | Codex | DeepSeek-V4-Pro | 2026-06-16 | 2.15 | 2.25 | 1.69 | 1.97 | 2.63 | 收录 |

未收录的三行不是删减总榜，而是平台身份约束的硬结果：`Seele02-pro`、
`Deepseek-V4-Flash-0731` 与 `MiniMax-M2.7` 在 EvalHub 平台模型注册表中都没有对应条目
（注册表里 MiniMax 只有 M3），
写进成绩文件会被 `scripts/model-contract.mjs` 判为未知模型而使 CI 失败；
把它们改映射到别的模型属于事实篡改。完整 12 行如上表保留在此，并在每条收录成绩的
`official-full-leaderboard` 共享辅助视图中逐格转录。

收录的 9 行里，上游把推理档位写进了模型字符串（`Fable 5 high`、`GPT-5.6-sol high`、
`GPT-5.5 high`、`Opus-4.7 high`）。平台注册表只认不含档位的 canonical 名，
因此成绩文件的 `participant.model` 用 `Claude Fable 5` / `GPT-5.6 Sol` / `GPT-5.5` /
`Claude Opus 4.7`，并在每条成绩的 `detail` 里原样保留上游字符串与 high 档位。
这是身份规范化，不改动任何分数。

每行附三个共享视图：`official-full-leaderboard`（完整 12 行官方总榜）、
`official-category-scores`（总分与四类分项）与
`official-token-usage`（README「Token usage」表）。上游只对 4 个配置发布了 token 用量，
它们都在本目录收录的 9 行里（Claude Opus 4.7、GPT-5.5、Kimi K2.6、DeepSeek V4 Pro）；
余下 5 行（Claude Fable 5、GPT-5.6 Sol、Kimi K3、MiMo V2.5 Pro、GLM-5.1）的六个格子全部留空，
不做任何推算或补齐。

### `paper-table6-2026-06-16.json`

论文 Table 4 与 Table 6，收录 7 个论文配置中身份可解析的 6 个（`MiniMax-M2.7` 同样无法解析）。
Table 6 的价值在于它发表了官网榜单没有的**15 个游戏族 × 5 个指标**完整分家族成绩，
逐格转录进 `paper-family-breakdown` 视图。论文的 5 个总表数值与官网同一配置逐格一致。

## 运行与提交

参赛方在自己的基础设施上按上游协议跑完 140 题，然后用本目录的转换器打包成绩：

```bash
node evals/gamecraft-bench/pack-to-result.mjs <submission.json> --out gamecraft-bench-result.json
```

`tasks/example-submission.json` 是结构示例（合成数值，非任何真实成绩），
用于文档说明与锁定的 CI 沙箱；真实提交必须用参赛方自己的清单。

转换器不联网、不调用模型、不读环境变量，只做确定性校验与算术，并强制这些协议边界：

- 题目集合必须与 `eval.yaml` 的 140 个稳定任务 ID 完全一致，不多、不少、不重复；
- 每题 `reward` ∈ `[0,1]`，与官方 `reward.txt` 的值域一致；
- `build_ok=false` 的题目 `reward` 必须恰为 0（闸门失败时上游必然短路为 0）；
- `scored_demos` ∈ `[0,10]`；为 0 时 `reward` 必须为 0；
- `judge` 必须是上游默认的 `openai` / `gpt-5.5`；
- 任一条不合法即整体转换失败，绝不写出半成品，也不用 `null` 充数。

结果信封先经共享 schema 与本评测契约二次校验，再原子替换目标文件。

## 复现门槛

单题名义预算是 Agent 7200 秒 + 验分 1800 秒（这两项 140/140 一致），构建超时 600 秒（133 份 `task.toml` 声明，7 份省略）。
环境字段以多数值为准：1 CPU（136 份声明）、2048 MB（129 份；7 道开放世界题为 4096 MB）、
10240 MB 存储（136 份）、0 GPU（129 份）、解题阶段允许联网（133 份）；少数 `task.toml` 省略了对应字段，
省略项的实际取值由 Harbor 默认值决定，上游未在仓库内声明。
取证链路需要 Godot 4.6.2-stable（README 记录的版本串为 `4.6.2.stable.official.71f334935`）、
Xvfb、xdotool、ffmpeg，参考环境为 Ubuntu 22.04 + Python 3.12。
跑满 140 题还要叠加每个 demo 一次的多模态裁判调用。这不是能在本地免费快速复跑的评测。

## 许可与再分发边界

- 上游仓库为 **Apache-2.0**（`LICENSE` 与 `pyproject.toml` 一致声明）。
  需注意其 `LICENSE` 未填写版权人（仍是 Apache 模板占位），仓库也没有 `NOTICE`，
  因此本目录不声称任何具名版权人。
- 论文为 **CC BY 4.0**（arXiv 摘要页许可区块）。本目录引用的两张图与「洞察」图均来自论文。
- 上游依赖：Harbor（Apache-2.0）、Godot（MIT，4.6.2-stable 发布于 2026-04-01）。
- 官方项目页自述改编自 Nerfies（CC BY-SA 4.0），站点自身内容无独立许可文件，
  因此本目录只链接该站点，不搬运其静态资源与录像。

本目录**只转录文本与数值**，不搬运任何第三方素材：

- Kenney 与 OpenGameArt 资产库都不在上游仓库里，仓库只提供下载清单，本目录不抓取、不入库。
  需要说明的是，README 把 OGA 池概括为「CC0 / permissive」，但其下载清单里包含少量
  GPL 与 CC-BY-SA 条目，并非全部宽松许可；本目录不分发这些素材，故不受影响。
- 不搬运 `media/benchmark_title.png`（Agent 生成画面的拼图，可能内嵌第三方素材美术）。
- 不搬运 `tools/godot_command_line.md`（内容高度接近 CC-BY-3.0 的 Godot 官方文档页，
  上游未附署名与许可说明）。

## 已知边界

- 论文（2026-06-16，最高 41.46）与官网榜单（到 2026-08-10，最高 65.72）是两个时间点的快照，
  上游未声明新增配置是否使用同一版验分器与同一裁判模型，仓库也没有 tag/release 可区分版本。
- 仓库 README 正文写最强配置为 65.70%，但同页表格与官网都写 65.72。
  本目录采用逐格数据 65.72，并在此如实记录这处来源自身的不一致。
- 裁判是打分链路里最主要的不确定来源：仓库未钉死裁判的采样温度或随机种子。
  论文用固定证据重复 10 次裁判展示稳定性（Figure 9），这属于经验证据而非固定解码配置。
- `rubric.json` 里的 `categories` 字段实际不被任何上游代码读取（dashboard 按条目 `M/D/V/A`
  前缀归组），属于文档性元数据；本目录的四类命名以它与 dashboard 代码一致的键名为准。
- 覆盖面只到 Godot 2D，不含 Unity/Unreal、3D、多人联机、大规模物理与长周期生产流程；
  音频相关要求通过画面上的可见反馈间接体现；评测不试图衡量游戏是否好玩。
- 本目录没有 EvalHub 实跑，因此不含任何 `task_results` 或 `showcases` 形式的真实执行证据；
  `sample-result.json` 只是结构示例，不得当作官方成绩或真实复跑。

## 引用

上游 README 给出的引用格式：

```bibtex
@article{luo2026gamecraft,
  title={GameCraft-Bench: Can Agents Build Playable Games End-to-End in a Real Game Engine?},
  author={Luo, Tongxu and Wang, Rongsheng and Bi, Jiaxi and Xu, Chenming and Tang, Zhengyang and Chen, Jianlong and Liang, Juhao and Ji, Ke and Guo, Shuqi and Du, Yuhao and Bu, Fan and Du, Wenyu and Zhang, Xiaotong and Li, Kyle and Wang, Shaobo and Zhang, Linfeng and Liu, Yuxuan and Lai, Xin and Li, Chenxin and Guo, Yiduo and Zhang, Zhexin and Wang, Xinyuan and Bai, Tianyi and Li, Ziniu and Wang, Benyou},
  journal={arXiv preprint arXiv:2606.17861},
  year={2026}
}
```
