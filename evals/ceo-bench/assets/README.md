# assets

本目录不放二进制素材，只留这份说明。

`eval.yaml` 的 `detail_profile.figures` 里只有一张图，通过 HTTPS 直接引用上游官方发布的原图，
没有在本仓库内复制或转存：

| id | 说明 | 图片来源 | 发布页 |
| --- | --- | --- | --- |
| `world-mechanics` | 官方模拟世界机制图 | `https://ceobench.com/assets/figures/world-mechanics.png` | https://ceobench.com |

这样做的原因有两条：

- 图是上游作者的作品，直接引用官方站点让读者看到的始终是作者当前发布的版本，不会出现本仓库
  副本与官方原图不一致的情况；
- 上游仓库 `zlab-princeton/ceobench-src` 没有放出 LICENSE 文件，GitHub API 也报告不到许可证。
  在授权边界只到这个程度时，引用而不再分发副本是更保守的做法。

图的 `alt` 与 `caption` 只描述图里实际画了什么，`source_url` 指回官方站点。如果上游撤下或替换
原图，本条目应改成移除该 figure，而不是换成本地重绘或推测性的替代图。

官网首页的现金曲线图与客户数曲线图由前端脚本渲染，没有可引用的静态图片地址，因此没有作为
figure 收录，也没有据表格推算出任何曲线。
