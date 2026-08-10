# Terminal-Bench 结果清单

这个目录不存放 Terminal-Bench 的容器、数据、测试或 solution。真实评测在外部 Harbor 环境中完成后，把 74 题 × 5 次尝试的 Harbor 身份、固定 task digest、最终 reward，以及逐 trial 的原始 `result.json`/`lock.json` SHA-256 整理为一个 JSON 清单，再由 `pack-to-result.mjs` 转成 EvalHub 结果。

`example-submission.json` 是完整但纯合成的结构样例。它没有对应真实 Agent 或 Harbor job，不能作为基线或成绩。

## 顶层格式

```json
{
  "manifest_version": 2,
  "eval_id": "terminal-bench",
  "protocol_revision": 1,
  "upstream_commit": "2b0442c3c583b710ca8da14c8e601b99f2f1f244",
  "harbor_version": "0.20.0",
  "harbor_commit": "459ff6ec99417589b7f679d14ddf3b3f0ae4f1dc",
  "participant": {
    "model": "provider/model-id",
    "harness": "agent-or-harness-id",
    "harness_version": "version-or-commit"
  },
  "run_date": "2026-08-10",
  "harbor_job": {
    "job_id": "2f3a4b5c-6d7e-4f80-9a1b-2c3d4e5f6071",
    "evidence_sha256": "64位小写十六进制SHA-256"
  },
  "tasks": []
}
```

约束：

- `manifest_version` 只能是整数 `2`。
- `eval_id`、`protocol_revision`、`upstream_commit`、`harbor_version`、`harbor_commit` 必须与上例完全一致。
- `participant.model` 必须是至少 4 个字符的 ASCII 模型 ID。
- `harness` 和 `harness_version` 要么同时提供，要么同时省略；真实成绩建议完整记录。
- `run_date` 必须是真实的 `YYYY-MM-DD` 日历日期。
- `harbor_job.job_id` 取自保留的真实 Harbor job `result.json.id`，必须是非 nil 的 lowercase canonical UUIDv4。
- `evidence_sha256` 应是证据包原始字节的 SHA-256；转换器拒绝全零、单字符或重复单元组成的明显占位摘要。
- 每层对象都拒绝未知字段。

## 每题格式

```json
{
  "task_id": "atrx-vep-crispr",
  "task_digest": "sha256:3b8eb57602814aa63af12439e3eacb7ad5bee09efb6c6af023768994bf9220b4",
  "trials": [
    {
      "trial_id": "44544b0c-fe20-4a12-8d1b-b50e6e78eb9d",
      "trial_name": "atrx-vep-crispr__FZKGUBC",
      "result_sha256": "a80bf6dc4fea3dde3071926fabbe0a0b3c525fe81bfedbb724bdd6b06c57875a",
      "lock_sha256": "4decee19e624ba02910080e974d5264f71ba85d7313e6c8d0f83361513c28c4a",
      "reward": 0
    },
    {
      "trial_id": "7852d7b0-08ed-4c5a-8521-3e2f5b74112d",
      "trial_name": "atrx-vep-crispr__PvNBmNR",
      "result_sha256": "59b54746404bf566ae044a124da1bfcb8c763d07f2a929ca90801596af2606f4",
      "lock_sha256": "4decee19e624ba02910080e974d5264f71ba85d7313e6c8d0f83361513c28c4a",
      "reward": 1
    },
    {
      "trial_id": "916732cc-7237-4d9a-9025-b1ca7d247ffa",
      "trial_name": "atrx-vep-crispr__Rp8pKUn",
      "result_sha256": "a433a995d2b251c09ccdfb23c951c1b64c1503260ab77241fca54eee4a2d163b",
      "lock_sha256": "4decee19e624ba02910080e974d5264f71ba85d7313e6c8d0f83361513c28c4a",
      "reward": 0
    },
    {
      "trial_id": "aad32c36-4f36-4388-9454-bc4795c26963",
      "trial_name": "atrx-vep-crispr__ZQPLAbv",
      "result_sha256": "508f6e2c2b4d50ce450d1cc1d930745cf7f524dab409508fa91d7021cf310a96",
      "lock_sha256": "4decee19e624ba02910080e974d5264f71ba85d7313e6c8d0f83361513c28c4a",
      "reward": 1
    },
    {
      "trial_id": "a7fc59d0-ef6f-4341-9e39-f46133ad20e6",
      "trial_name": "atrx-vep-crispr__5CZhSpV",
      "result_sha256": "53ebc4965c199a5bc705db3310ab3c62f10d1fc83b9cdfa9c51ef22914ad70f7",
      "lock_sha256": "4decee19e624ba02910080e974d5264f71ba85d7313e6c8d0f83361513c28c4a",
      "reward": 0
    }
  ]
}
```

必须恰好提交 `eval.yaml` 中的 74 个稳定任务 ID，不能重复、遗漏或加入未知任务。每个 `task_digest` 必须精确匹配 Terminal-Bench v3.0.0 `tasks/dataset.toml` 中该任务的 digest；转换器内置同一组 74 个摘要并逐项核对。

每题必须恰好包含 5 个 trial。任务对象和 `trials` 数组都可以任意排序：输入数组位置没有 Harbor attempt 序号语义，转换器会按固定任务顺序输出，并在每题内部按 `trial_id` 的 ASCII 字典序排序，再派生展示序号 `1–5`。

每条 trial 的身份必须先从真实 Harbor 产物核对：

- `trial_id`：同名 trial 目录中 `result.json.id` 的非 nil lowercase canonical UUIDv4。
- `trial_name`：同一 `result.json.trial_name`，并且必须与 trial 目录名一致；默认名称形状是 `<task-id[:32].rstrip("_-")>__<7-char ShortUUID>`。
- `result_sha256`：对提供该 trial ID、名称和 reward 的同一份 `result.json` 原始字节计算的小写 SHA-256。不得先解析后重新序列化、格式化或改行尾再计算。
- `lock_sha256`：对提供 `task.digest` 的同一份 `lock.json` 原始字节计算的小写 SHA-256。不得先解析后重新序列化、格式化或改行尾再计算。
- `task_digest`：逐个读取五个 trial 目录的 `lock.json > task.digest`，确认它们都相同后填写任务级字段。不要使用 `result.json.task_checksum`：Harbor 已把它标为 legacy，uploader 的权威内容身份来自 trial lock。
- 370 个 `trial_id`、370 个 `trial_name` 和 370 个 `result_sha256` 都必须全局唯一；任何 trial ID 都不能与 job ID 相同。
- `lock_sha256` 可以在同一任务的多个 trial 间重复，因为解析后的运行输入可能产生逐字节相同的 lock；但同一个 lock 摘要不能出现在两个不同任务中，因为其原始内容包含不同的 `task.digest`。任何 result 摘要都不能冒用为 lock 摘要，反之亦然。

`example-submission.json` 中的逐 trial SHA-256 是确定性合成值，只用于展示完整结构。真实提交必须保存原始文件，先对原始字节计算摘要，再从完全相同的字节中读取字段；不能用手工拼接字符串或重新导出的 JSON 代替文件摘要。证据包应保留每个 trial 目录及其原始 `result.json`、`lock.json`，接纳成绩时要逐项重算并与清单比对。

## reward 提取

对真实成功 trial，只从 `result.json.verifier_result.rewards.reward` 提取值。它必须是有限 JSON number 且满足 `0 <= reward <= 1`；二元 `0/1` 与连续小数都有效，转换器会把每条逐 trial 成绩映射为 `reward × 100`。

- 上游最终 reward 是有效 `[0,1]` 数值：原样填写，不要二值化。
- 超时、Agent 失败、容器失败或基础设施失败：显式写 `0`。
- `verifier_result`、`rewards` 或 `reward` 缺失，或者 reward 为 `None`：显式写 `0`。
- reward 为布尔值、字符串、`null`、非有限值或落在 `[0,1]` 外：产物不符合清单协议，不能伪装成有效成绩。
- 未执行：清单不完整，不能提交；不能通过删除 trial 缩小分母。

失败 trial 仍必须有可解析的 Harbor `result.json` 和对应 `lock.json`，才能提供真实 ID、名称与两个文件摘要；如果这些文件本身缺失或损坏，清单不完整，不能编造摘要或身份，必须先从原始 job 恢复产物或重新运行。

转换器不读取 Harbor 目录或证据包，因此不会替作者重算 SHA-256 或证明清单字段确实来自所声明文件。它会检查摘要格式、明显占位值和可由清单自身判断的绑定冲突，并把摘要保留到结果中；作者接纳真实成绩前仍必须核对 job、370 个 trial 目录、运行配置、日志、异常记录、reward、task digest、逐文件摘要与 job 级证据包摘要。

## 禁止的自报字段

不要在清单里加入：

- `score`
- `aggregate`
- `denominator`
- `pass@k`
- `passed`
- 自定义权重或删题说明

主分只由转换器按 `sum(reward) / 370 × 100` 计算。

## 打包

```bash
node evals/terminal-bench/pack-to-result.mjs submission.json --out terminal-bench-result.json
```

成功输出包含一个 participant、0–100 的数值 `score` 和 370 条逐次 `task_results`。主分固定为 `sum(370 rewards) / 370 × 100`；`raw` 会保留派生 trial 序号、原 reward、真实 `trial_id`、`trial_name`、`task_digest`、`result_sha256` 与 `lock_sha256`。转换器只检查清单内容和结果 schema，不读取或审计 `evidence_sha256` 对应的证据包。
