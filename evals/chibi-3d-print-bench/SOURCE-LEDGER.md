# 一手来源台账

本条目是 EvalHub 原生协议；一手来源是作者维护的冻结本地输入、计分代码和运行元数据。公开仓库不分发人物素材和历史产物，只记录可核对摘要。

| 事实 | 冻结值 | 映射位置 | 边界 |
| --- | --- | --- | --- |
| 题面 | SHA-256 `69c3fecf345bf5ce8be394624e3fcec2c5523f2ae8352607c56cf2015557af7d` | `eval.yaml` task prompt | 逐字转录 |
| 参考图 | SHA-256 `6d89ce11b40c68c3c2c19cfd3e394bb09f6cad984b184b475c45afbc1f13eb64`；821833 字节 | task `run_spec` | 含人物信息，不公开分发 |
| 打印合同 | SHA-256 `953ca660c7dc89ea2c381320af0f5daf4511c60eea08eeb1079e8e8a71dd6e5f` | `scoring_note`、`tasks/README.md` | 统一 A2L 参数 |
| A2L 流程 | SHA-256 `13eaa646495259a974c7924921a7e3e543cddcdef9eb519a30ded8a412875814` | task `run_spec` | Bambu Studio 02.07.01.62 |
| 自动 scorer | SHA-256 `e8711518e800763f126420bfbabf636b7f7e8bdd3e23e41f726e6f23a3fa4b77` | `pack-to-result.mjs` 公式 | 原代码不分发；公式独立重写 |
| 运行环境 | Pi 0.82.0；thinking=max；1 轮；5400 秒 | task `run_spec` | 无扩展、技能、上下文与外部服务 |
| 人工量表 | 相似度 25、雕塑一致性 10、预览清晰度 5 | `eval.yaml`、转换器 | 必须由作者盲审认可 |

面向读者的一手 HTTPS 入口是合并后的协议包：<https://github.com/502399493zjw-lgtm/evalhub-evals/tree/main/evals/chibi-3d-print-bench>。当前不存在独立论文、官网或公共源仓库；详情页没有把本地路径写成读者资源。
