# ReplyBench 任务与提交清单

## 题面来源

17 道题的完整题面(即发给被测模型的逐字 prompt)在 `eval.yaml` 的 `tasks[]`,逐字转录自上游仓库 pinned commit(`Begin5257/replybench@e35ee162821d` 的 `cases/*.json`,经 `lib.mjs renderContext` 渲染,与正式跑批所用完全一致)。运行约定(采样温度/次数/判分协议)在各题 `run_spec`,不混入题面。

## 提交清单格式(external_workflow)

参赛者在上游仓库完成 `run.mjs → judge.mjs → aggregate.mjs` 三步后,提交如下 JSON:

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `participant.model` | string | 参赛模型(须能被 EvalHub 模型注册表解析) |
| `participant.harness` | string? | 编排产品(可选;基座模型直接调 API 时省略) |
| `summary` | object | 上游 `node aggregate.mjs` 产出的 `report/summary.json` 原文(须 `partial=false`,17 题 × 4 采样完整 cohort) |

转换器 `pack-to-result.mjs` 校验 cohort 完整性与数值范围后确定性写出结果信封;分母与口径内置,不接受提交方覆盖。`tasks/example-submission.json` 是纯文档示例(合成 participant),平台与 CI 不会执行它。

## 判分产物要求(scored_by=author)

分数被认可前,评测作者会核对提交方的 `results/`、`judgments/` 逐题产物与判分配置(双裁判身份、strict AND、哨兵校准 35/35)。只有 summary 而无产物的提交不予认可。
