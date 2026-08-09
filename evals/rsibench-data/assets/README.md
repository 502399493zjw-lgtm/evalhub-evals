# assets

本目录不放二进制素材，只留这份说明。

`eval.yaml` 的 `detail_profile.figures` 里有三张图，全部通过 HTTPS 直接引用上游官方发布的
原图，没有在本仓库内复制或转存：

| id | 说明 | 图片来源 | 发布页 |
| --- | --- | --- | --- |
| `motivation` | 研究动机图 | `https://oss.evolvent.co/articles/1785592088134_01_motivation_cropped.png` | https://evolvent.co/en/research/RSIBench-Data |
| `framework` | 实验框架图 | `https://oss.evolvent.co/articles/1785592276068_02_framework_cropped.png` | https://evolvent.co/en/research/RSIBench-Data |
| `trajectories` | 官方候选轨迹图 | `https://oss.evolvent.co/articles/1785593089141_03_trajectories.png` | https://evolvent.co/en/research/RSIBench-Data |

这样做的原因有两条：

- 图是上游作者的作品，热链官方 OSS 让读者看到的始终是作者当前发布的版本，不会出现本仓库
  副本与官方原图不一致的情况；
- 上游仓库没有放出独立的 LICENSE 文件，官方文章页标注 CC BY-NC 4.0。在授权边界只到这个
  程度时，引用而不再分发副本是更保守的做法。

每张图的 `alt` 与 `caption` 只描述图里实际画了什么，`source_url` 指回官方发布页。如果上游
撤下或替换原图，本条目应改成移除该 figure，而不是换成本地重绘或推测性的替代图。
