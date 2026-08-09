# 提交清单、盲审与原帧复用审计

真实运行在作者控制的离线环境完成；转换器接收 JSON 清单，不读取视频二进制。

## 顶层字段

- `manifest_version`: 固定为 `1`。
- `eval_id`: 固定为 `mg-animation-replication`。
- `protocol_revision`: 固定为 `1`。
- `task_id`: 固定为 `mg-animation-replication-v1`。
- `participant`: `model`、`harness`、`harness_version`，均写实际身份。
- `run_date`: 真实存在的 `YYYY-MM-DD`。
- `protocol`: 填写题面、计划、配置、品牌 JSON、参考视频、Logo、字体、品牌校验脚本的冻结摘要，以及 `timeout_seconds=5400`。
- `result`: 状态、原帧复用判定、媒体检查、六项量表和证据摘要。

## result

`status` 只接受 `scored`、`invalid`、`failed`、`timeout`、`missing`。

- 只有 `scored` 能获得非零分，并要求 `original_frames_reused=false`、成片存在且可播放、文件名合规。
- `invalid` 专用于确认复用了参考片可见原始画面，要求 `original_frames_reused=true`。
- `failed`、`timeout`、`missing` 要求 `original_frames_reused=false`；若尚无法确认复用，不得臆测为 true。
- 所有非 `scored` 状态的六项量表必须全为 0，主分固定为 0。

`media` 字段：

- `video_exists`、`playable`、`filename_ok`、`brand_ui_ok`、`temp_files_cleaned` 为布尔值。
- `filename` 为实际文件名或 `null`；存在成片时必须以 `.mp4` 结尾且不能是 `final.mp4`。
- `width`、`height`、`fps`、`duration_seconds`、`audio_sample_rate_hz`、`audio_channels` 在成片存在且可播放时必填，否则必须为 `null`。

`rubric` 六项范围：`timeline` 0–30、`composition_visual` 0–25、`motion_transitions` 0–15、`technical_quality` 0–15、`brand_and_filename` 0–5、`tool_loop` 0–10。

`evidence` 必须绑定运行日志、媒体报告、帧复用审计和盲审表；成片存在时填写 `video_sha256`，否则为 `null`。每份证据使用不同 SHA-256。

## 原帧复用审计

禁止的是任何可见参考帧或视频片段进入结果，包括直接拼接、画中画叠加、裁剪、变速、转码或重封装；允许直接保留原音轨。审计至少组合以下证据：

1. 查看完整运行日志与构建入口，确认视频输入只用于分析和可选音轨提取。
2. 对参考片和结果做抽帧、感知相似度与局部匹配检查，重点复核高相似片段。
3. 人工查看可疑帧，区分“独立复刻很像”与“原像素被复用”。
4. 在盲审表中记录结论、依据、参考视频摘要、成片摘要和审阅日期。

简单 SHA-256 或完全相同帧检测不足以排除轻微变形后的复用，因此转换器只执行状态一致性，最终结论由作者认可。

## 盲审

盲审者在隐藏模型与 harness 名称后，观看冻结参考片和完整结果片，按 `eval.yaml` 的六项量表给出整数或有限小数。品牌与技术项还要核对品牌 JSON、ffprobe 报告和实际文件名；工具闭环要核对日志中的参数读取、抽帧观察、构建、编码、验证与清理。作者在发布前复核盲审表与原件。

## 合成示例

`example-submission.json` 的 participant、分数、媒体值与摘要均为结构演示而构造，不对应任何真实模型或成片。`sample-result.json` 只是转换结果形状示例。
