# 一手来源台账

本条目是一套 EvalHub 原生协议；一手来源是作者 2026-07-21 冻结的本地任务归档。公开仓库不分发视频、品牌资产和历史产物，只记录事实与摘要。

| 事实 | 冻结值 | 映射位置 | 边界 |
| --- | --- | --- | --- |
| 题面 | SHA-256 `17d3870e7fca163d8a7c269968bd9462254244c64aaed670ae7d40f6af8d438f` | `eval.yaml` task prompt | 逐字转录 |
| 测试计划 | SHA-256 `f9a2f51da820b7cb4754715145d695d1a137b482e4e29f18a2576e704155bfa1` | 六项量表与运行规则 | 不复制历史成片 |
| 测试配置 | SHA-256 `1facda3b3a305bc8ee5deb6e16312b0a45c2c64805366389515a8db80bd3f5dd` | task ID、5400 秒、输入与模型清单 | 历史模型清单不等于成绩 |
| 品牌 JSON | SHA-256 `8fa8bbc2d279a9d8a1f3c742c589e82cbfd8d8b8b181066608336ffb0f6c59da` | 题面与 run_spec | 原文件不随包分发 |
| 参考视频 | SHA-256 `86cab73954c05b6811e23c6ebefa5c923af585db19c65ac6a9eb5bd51a625ce9`；8964161 字节 | task `run_spec` | 不公开分发 |
| Logo | SHA-256 `e3bf841329f81c1f4b269f930299306cbc9a614a030049ba5e9369ad65a02086` | task `run_spec` | 不公开分发 |
| Fusion Pixel 字体 | SHA-256 `b4f59dce22df0f43425262611a786b7f1581fa2667fad5861afbfb249e5a8dba` | task `run_spec` | 不公开分发 |
| 品牌校验脚本 | SHA-256 `227c12a6ba7dee103b52f8c35ca45a7f53cc4c7c441f2fe9414b27d49c708783` | 媒体检查说明 | 只能检查部分品牌像素，不产生总分 |
| 参考媒体参数 | 1280×720；H.264；30000/1001 fps；56.704 秒；AAC 48 kHz 双声道 | `detail_profile` 与 run_spec | 由 ffprobe 对冻结文件确定性读取 |

面向读者的一手 HTTPS 入口是合并后的协议包：<https://github.com/502399493zjw-lgtm/evalhub-evals/tree/main/evals/mg-animation-replication>。当前没有独立论文或公共源仓库；详情页没有把本地路径冒充成读者可访问来源。
