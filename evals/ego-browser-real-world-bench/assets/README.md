# 素材

上游任务数据集中有一道任务依赖附件，但附件、截图、会话和其他执行产物均未复制到本包中。
本次详情页的「官方分项结果」使用一张用户指定的 PNG 价值地图作为展示资产；该图片不属于
EvalHub 的运行证据，也不增加结构化成绩记录。

图片通过当前投稿 fork 的固定 GitHub Release 资产引用，避免把 PNG 二进制放入评测目录（内容
仓库只允许静态 SVG 图文件）。图片 SHA-256 为
`f5a64e1b1d82404a3e657fbdab667035e2b2c7ac4707325cd66d6a68c5d594c8`。图中 16 个点及两条
中位线依据 citrolabs 固定提交 `f566ac293e4e6bd80c4e9b062b5699f04eac41f4` 的
`reports/ego-benchmark-model-metrics-2026-08-04.md`，其中 3 个无法映射至 EvalHub 注册表的
模型仅作为图像展示保留。
