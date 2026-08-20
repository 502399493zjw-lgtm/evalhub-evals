# Terminal-Bench 2.1 结果清单

本目录不复制上游容器、测试、solution、数据、二进制或媒体。真实评测必须先在 Harbor 中完成，再把 89 题 × 5 次尝试的身份、固定 task digest、reward 与逐 trial 证据摘要整理为 JSON 清单，由 `pack-to-result.mjs` 转成 EvalHub 结果。

`example-submission.json` 是结构完整但纯合成的夹具，不对应真实 Agent 或 Harbor job，不能作为基线或成绩。

## 外部运行

上游当前建议安装 Harbor、登录、运行数据集并上传 job；社区提交暂时关闭，仅维护者运行可进入官方榜单。以实际可审计环境执行：

```bash
uv tool install "harbor[daytona]"
harbor auth login
harbor run -d terminal-bench/terminal-bench-2-1 \
  --agent <agent> --model <provider/model> --n-attempts 5
harbor upload <job-dir> --public
```

上游没有固定 Harbor 版本，因此清单必须如实填写实际 `harbor_version` 与该版本对应的 40 位 `harbor_commit`；不得把本文示例值当作官方指定版本。题集身份固定为 commit `7131e4375048a0e408a8fb404b5f499d726b695b`，其 `tasks/dataset.toml` 中的 89 个 digest 已内置到打包器。

## 清单格式

```json
{
  "manifest_version": 2,
  "eval_id": "terminal-bench-2-1",
  "protocol_revision": 1,
  "upstream_commit": "7131e4375048a0e408a8fb404b5f499d726b695b",
  "harbor_version": "实际版本号",
  "harbor_commit": "实际 Harbor commit 的 40 位小写十六进制 SHA-1",
  "participant": {
    "model": "registry-resolvable/provider-model-id",
    "harness": "agent-or-harness-id",
    "harness_version": "version-or-commit"
  },
  "run_date": "YYYY-MM-DD",
  "harbor_job": {
    "job_id": "lowercase canonical UUIDv4",
    "evidence_sha256": "证据包原始字节的 64 位小写 SHA-256"
  },
  "tasks": []
}
```

每题对象包含 `task_id`、固定 `task_digest` 和恰好 5 个 `trials`。每个 trial 包含真实 `trial_id`、`trial_name`、原始 `result.json` 与 `lock.json` 的 SHA-256，以及 `reward`。必须提交全部 89 题和 445 个 trial；不能重复、删题、改分母或加入自报总分。

清单中的 `task_id` 始终使用 Harbor 的原始任务名。唯一包含句点的上游任务 `install-windows-3.11` 在 EvalHub 结果中确定性映射为稳定机器 ID `install-windows-3-11`；题面、digest、trial 名称与上游身份均不改变。

## reward 与奖励黑客判定

官方 Accuracy 的成功条件是 reward 大于 0。对通过奖励黑客审查的 trial，填写 `result.json.verifier_result.rewards.reward` 的有限数值；超时、执行失败、缺失/None reward，以及被官方审查判定不合格的 trial，必须在清单中显式填 0。打包器保留原 reward 到证据文本，但逐 trial 分只派生为 0 或 100，主分固定为成功数 / 445 × 100。

打包器不能自行访问 Harbor Hub 或证据包，因此作者接纳成绩前仍必须逐项核对 job、运行配置、日志、奖励黑客审查结论、445 份结果、task digest 和文件摘要。

## 打包

```bash
node evals/terminal-bench-2-1/pack-to-result.mjs submission.json --out terminal-bench-2-1-result.json
```
