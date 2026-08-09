# tasks

本目录只放本评测的确定性输入夹具，不放上游任务内容——140 道题的题面原文已逐字符转录进
`../eval.yaml` 的 `tasks[].prompt`。

## `example-submission.json`

`pack-to-result.mjs` 的结构示例输入，也是锁定 CI 沙箱注入的那份夹具。

它枚举 `eval.yaml` 里全部 140 个真实任务 ID，但**所有 `reward`、`scored_demos`、
`build_ok` 与 `evidence_sha256` 都是按任务 ID 哈希确定性生成的合成值**，
其中 6 道题（6/140）故意设成 `build_ok: false` + `reward: 0` + `scored_demos: 0`，用来验证闸门不变量。

**它不是任何模型的成绩，也不是任何真实复跑。** 由它生成的
`../sample-result.json` 同理，只用于校验结构与运行转换器，不得在任何文案里
称作官方成绩、基线或真实复跑。真实官方成绩在 `../published-results/` 下。

## 字段含义

| 字段 | 说明 |
| --- | --- |
| `manifest_version` | 目前只支持 `1` |
| `eval_id` | 必须是 `gamecraft-bench` |
| `protocol_revision` | 必须与 `eval.yaml` 的 `protocol_revision` 一致 |
| `upstream_commit` | 必须是本评测钉死的来源 commit |
| `judge.backend` / `judge.model` | 必须是上游默认的 `openai` / `gpt-5.5` |
| `participant.model` | 被评编排模型的 ID；只能用 ASCII 字母数字与 `._/:+-`，不含空格（平台模型识别的字符集） |
| `participant.harness` | 编排产品（如 `Claude Code`、`Codex`），必填 |
| `participant.harness_version` | 必填：agent 参赛者的 harness 与版本在共享 schema 里是成对字段 |
| `run_date` | 真实存在的 `YYYY-MM-DD` 日期 |
| `tasks[]` | 长度必须恰为 140，与 `eval.yaml` 的任务 ID 集合完全一致、不重复 |
| `tasks[].task_id` | `eval.yaml` 里的稳定任务 ID |
| `tasks[].run_id` | 该题这次运行的标识，便于回溯 job 目录 |
| `tasks[].build_ok` | 闸门命令 `godot --headless --path /workspace/game --quit-after 5` 退出码是否为 0 |
| `tasks[].reward` | 官方验分器 `reward.txt` 的值，必须 ∈ `[0,1]` |
| `tasks[].scored_demos` | 实际被判分的 demo 数，必须 ∈ `[0,10]` |
| `tasks[].evidence_sha256` | 该题验分产物目录的 sha256 指纹，供作者复核时定位证据 |

强制不变量：

- `build_ok=false` 时 `reward` 与 `scored_demos` 都必须恰为 0——闸门失败时上游 `score.py` 直接跳过回放与判分。
- `scored_demos=0` 时 `reward` 必须恰为 0——没有 demo 被判分则全部 requirement 记 0。
- 140 个 `run_id` 与 140 个 `evidence_sha256` 必须各自互不相同：不同题目是不同的验分运行，产物目录不可能同摘要。
- 清单内不得出现重复的 JSON 键：重复键会让人工核对看到的值与转换器实际取用的值不一致，直接拒收。

## 怎么产生真实提交

在上游固定 commit 上跑官方验分器，每题会写出 `reward.txt`、`breakdown.json`、
`judge_log.json`、`build.log` 与 `demos/<id>/` 下的 mp4 与抽帧。
按上表把 140 题的结果汇总成一份清单，然后：

```bash
node evals/gamecraft-bench/pack-to-result.mjs my-submission.json --out gamecraft-bench-result.json
```

保留上述验分产物：`scored_by: author` 意味着成绩须由评测作者核对这些产物后才认可。
