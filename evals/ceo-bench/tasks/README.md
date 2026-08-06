# 任务与合成夹具

`example-evidence/` 是一份完整、可直接复制的合成提交目录，用来测试 `pack-to-result.mjs`。其中的模型名、金额、URL 和运行轨迹全部是合成数据：

- `example-evidence/submission.json`：参赛模型、provider、harness 与三个公开 artifact 的声明。
- `example-evidence/run-{1,2,3}/`：与 manifest 同级的三次合成证据。
- `example-submission.json`：仅供仓库的隔离 runner CI 使用，内容指向同一组合成证据；正式 CLI 的 `{input}` 不会自动选择它。
- 每次证据均含 remote、commit、唯一 session 列表、status、final cash 查询与经过白名单脱敏的 history JSONL。

审查源码后，在 `evalhub fetch` 下载的 pinned checkout 根目录显式安装锁定依赖，再运行合成测试。转换器不会静默安装依赖；不要使用可能改写锁文件并破坏 checkout 洁净性的 `npm install`：

```bash
npm ci --ignore-scripts
node evals/ceo-bench/pack-to-result.mjs \
  evals/ceo-bench/tasks/example-evidence/submission.json \
  --out /tmp/ceo-bench-example-result.json
```

这些数据不是任何真实模型的实测成绩，也没有通过评测作者验证。真实提交必须另建提交目录，不要修改或冒充这些夹具。

`princeton-official-results-2026-08-03.json` 是 Princeton 官网公开结果的当前结构化来源快照，也是 `../official-result-to-envelope.mjs` 生成 18 份版本化官方基线的唯一分数来源；对应的 `princeton-trajectory-manifest-v12-summary-2026-08-03.json` 按 run ID 保留清单披露的配置终点、实际终点和破产状态。带日期的旧快照继续保留作历史审计，不会被当前转换器读取。官网结果表是分数权威来源，轨迹清单只用于补充来源信息；两者不一致时不得用轨迹清单覆盖官网分数。转换器使用官网快照的 SHA-256 作为来源指纹，并校验金额、状态、运行数、破产数和最长存活天数。当前清单与官网在 Gemini 3.5 Flash 的运行批次上存在冲突，且不包含 Grok 4.5，文件中已明确标注。

这些快照用于作者录入和审计，不表示 EvalHub 已经独立复跑这些结果，也不要求公开页面逐条显示运行天数。
