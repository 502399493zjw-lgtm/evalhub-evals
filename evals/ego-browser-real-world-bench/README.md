# Ego Browser Benchmark: Real-World Bench

This EvalHub entry defines the upstream Real-World Bench task snapshot at commit
`f566ac293e4e6bd80c4e9b062b5699f04eac41f4`. It measures browser-agent task completion across 31 practical web
tasks and 154 binary rubrics. The task text in `eval.yaml` is copied verbatim from the
fixed upstream JSON; no upstream attachments, browser artifacts, screenshots, or run
trajectories are redistributed here.

## Primary score

**Perfect rate (%)** = `100 x all-rubrics-passed tasks / 31`. Higher is better. A task
contributes only when every one of its source rubrics passes, so a partially completed task
receives no primary-score credit. Rubric average is a published auxiliary metric and does
not affect the ranking score.

## Published-result boundary

The upstream report dated 2026-08-04 publishes a 16-model comparison. This EvalHub result
file deliberately contains only a **13-model source-backed subset**: the 13 source identities
that resolve to a canonical model in the current EvalHub registry. `Claude Opus 5`,
`DeepSeek V4 Flash`, and `ERNIE 5.1` are omitted because no verifiable canonical registry
identity exists at submission time. They are not mapped to nearby models, and this package
does not add an EvalHub rank, score, task result, showcase, or supplementary row for any of
them. Consequently, the EvalHub leaderboard is not a substitute for the upstream report's
complete 16-model ordering.

The result envelope is an `upstream_author_publication` transcription of the fixed report,
not an EvalHub rerun. It includes source-published performance, execution, judging, and
pricing views for the 13 included identities only. It intentionally has no task-level results,
outputs, or trajectories.

## External workflow and packer

This evaluation uses `runner: custom` with `custom_mode: external_workflow`. Users first
run the upstream benchmark in their own environment, then give the local packer a compact
manifest of the resulting 31 all-rubrics-passed verdicts:

```text
node evals/ego-browser-real-world-bench/pack-to-result.mjs <submission.json> --out <result.json>
```

The packer validates the fixed task set and computes the primary score. It does **not** run a
model, launch a browser, access websites, make network calls, read upstream run directories,
or rejudge any rubric. `scored_by: author` means a packed score remains subject to the
evaluation author's review of the original upstream evidence.

The upstream workflow is documented at the fixed commit and typically uses Python 3.13+,
`uv`, Node.js 22.13+, a macOS Ego Browser setup, model-provider credentials, and live
network access. Typical upstream commands are:

```text
uv run python run_eval.py --benchmark real-world-bench
uv run python run_judge.py --run-id <run_id>
```

Some source tasks require a signed-in account, one needs an upstream local site, and live
sites can change or impose anti-bot controls. Source task instructions can also cause real
form interactions or content creation. Review the upstream source and task behavior before
running it, and choose appropriate isolation, accounts, and permissions. EvalHub does not
execute, audit, guarantee, or endorse this third-party workflow.

`tasks/example-submission.json` and `sample-result.json` are structural examples only;
their all-false verdicts and synthetic participant do not represent any model run or source
result.

## Sources, version, and license

- Upstream repository: https://github.com/citrolabs/ego-browser-benchmark-framework
- Fixed source commit: `f566ac293e4e6bd80c4e9b062b5699f04eac41f4`
- [Pinned task dataset](https://github.com/citrolabs/ego-browser-benchmark-framework/blob/f566ac293e4e6bd80c4e9b062b5699f04eac41f4/data/real_world_bench.json) (SHA-256: `e1495bef65b83c7bcb4cf3bf7a6e515239c6763c620efe1d31749ad6d54f6200`)
- [Pinned official report](https://github.com/citrolabs/ego-browser-benchmark-framework/blob/f566ac293e4e6bd80c4e9b062b5699f04eac41f4/reports/ego-benchmark-model-metrics-2026-08-04.md) (SHA-256: `9d302fb27762c0885f6efa8292888e555babe3c71c9ed1e71247a982888cb611`)
- [MIT license](https://github.com/citrolabs/ego-browser-benchmark-framework/blob/f566ac293e4e6bd80c4e9b062b5699f04eac41f4/LICENSE), Copyright (c) 2026 ego-browser-benchmark-framework contributors

This package copies the task prompts under the upstream MIT license and preserves their source
commit and attribution. It does not imply upstream affiliation, certification, or endorsement.
