# assets

本目录不放二进制素材，只留这份说明。

`eval.yaml` 的 `detail_profile.figures` 里有三张图，全部通过 HTTPS 直接引用 arXiv v1 的
论文图，没有在本仓库内复制或转存。论文记录明确标注 CC BY 4.0：

| id | 说明 | 图片来源 | 发布页 |
| --- | --- | --- | --- |
| `motivation` | 论文图 1：研究动机 | `https://arxiv.org/html/2607.25886v1/x1.png` | https://arxiv.org/html/2607.25886v1 |
| `framework` | 论文图 2：实验框架 | `https://arxiv.org/html/2607.25886v1/x2.png` | https://arxiv.org/html/2607.25886v1 |
| `trajectories` | 论文图 3：候选轨迹 | `https://arxiv.org/html/2607.25886v1/x3.png` | https://arxiv.org/html/2607.25886v1 |

这样做的原因有两条：

- 论文 v1 明确采用 CC BY 4.0，图 1–3 的出处、编号和说明可以直接回溯到同一版本；
- 作者仓库没有独立 LICENSE 文件，官方文章页与其托管图片也没有另列许可，因此本条目不用
  文章页的裁切图，只引用许可边界明确的 arXiv 论文版本。

每张图的 `alt` 与 `caption` 只描述图里实际画了什么，`source_url` 指回官方发布页。如果上游
撤下或替换原图，本条目应改成移除该 figure，而不是换成本地重绘或推测性的替代图。
