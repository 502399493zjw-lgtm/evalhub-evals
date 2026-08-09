# 提交清单与盲审规范

真实运行在作者控制的离线环境完成；转换器只接收 JSON 清单，不读取二进制产物。

## 顶层字段

- `manifest_version`: 固定为 `1`。
- `eval_id`: 固定为 `chibi-3d-print-bench`。
- `protocol_revision`: 固定为 `1`。
- `task_id`: 固定为 `chibi-figure-a2-v2-20260803`。
- `participant`: `model`、`harness`、`harness_version`，三者均写实际身份。
- `run_date`: 真实存在的 `YYYY-MM-DD`。
- `protocol`: 必须逐项填写题面、参考图、打印合同、A2L 流程、scorer 的冻结摘要，以及 `pi_version=0.82.0`、`timeout_seconds=5400`。
- `result`: 本轮原始检查值与证据摘要。

## result

`status` 只接受 `scored`、`failed`、`timeout`、`missing`。所有状态都保留实际检查结果，不允许删掉失败后补跑。

- `artifacts`: `stl_exists`、`preview_ok`、`builder_exists`、`readme_exists`。
- `mesh`: `parsed`、`triangle_count`、`watertight`、`component_count`、`dimensions_mm`（`x/y/z`）、`stable_bottom`。未解析时除 `parsed=false` 外均为 `null`。
- `slicing`: `succeeded`、`estimated_seconds`、`warning_count`；失败时后二者为 `null`。
- `manual`: `likeness` 0–25、`sculpt_coherence` 0–10、`preview_clarity` 0–5。非 `scored` 状态三项必须全为 0。
- `evidence`: `run_log_sha256` 和 `automatic_report_sha256` 必填；存在的 STL、预览、脚本和 README 要填写各自摘要，不存在则为 `null`；`blind_review_sha256` 仅在 `scored` 状态必填，其他状态必须为 `null`。

转换器按固定公式重算：

```text
auto = STL×3 + 预览×3 + 脚本×2 + README×2
     + 可解析×3 + (三角面>=100)×2 + 水密×8 + (连通分量=1)×4
     + 尺寸合规×5 + 稳定底面×3
     + 切片成功×10 + (<=3600秒)×7 + (<=1800秒)×5 + (无警告)×3
score = auto + likeness + sculpt_coherence + preview_clarity
```

尺寸合规指 `z` 在 40–65 mm，且 `x`、`y` 均不超过 50 mm。切片未成功时所有切片分为 0。

## 盲审

盲审者只能看到冻结参考图和未美化、完整的原始 `preview.png`，不得看到模型或 harness 名称。按题面可见特征给出三项整数或有限小数分，并保存含 task ID、参考图摘要、预览摘要、三项分数和审阅日期的盲审表。`scored_by=author` 表示作者在发布前复核这张表和原件；转换器只能校验范围与摘要存在，不能代替审阅。

## 合成示例

`example-submission.json` 的 participant、检查值和摘要都为结构演示而构造，不对应任何模型或真实人物运行。摘要是固定字符串的 SHA-256；`sample-result.json` 仅演示结果形状。
