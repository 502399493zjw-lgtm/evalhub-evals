# assets

本目录为空，这是刻意的。

本评测详情页用到的图片全部直接引用论文托管方的无凭证 HTTPS 原图
（见 `../eval.yaml` 的 `detail_profile.figures`）：

| 用途 | 来源 |
| --- | --- |
| 总览图 | `https://arxiv.org/html/2606.17861v1/x1.png`（论文 Figure 2） |
| 判分链路图 | `https://arxiv.org/html/2606.17861v1/x4.png`（论文 Figure 5） |
| 裁判稳定性图 | `https://arxiv.org/html/2606.17861v1/x8.png`（论文 Figure 9） |

论文为 CC BY 4.0，图片按来源署名引用，不在本仓库内二次分发。

以下素材**刻意不放入**本目录：

- 上游仓库的 `media/benchmark_title.png`：它是 Agent 生成画面的拼图，
  可能内嵌第三方资产美术，来源侧未逐一说明这些美术的许可。
- Kenney 与 OpenGameArt 资产库：它们本来就不在上游仓库里（仓库只提供下载清单），
  且 OGA 清单中混有少量 GPL 与 CC-BY-SA 条目，并非全部宽松许可。
- 官方项目页的游戏录像与 Godot 导出物：该站点自身内容没有独立许可文件。

如果将来需要在本目录放静态展示资源，只能放可审阅的静态 SVG，
并在此登记其来源与许可。
