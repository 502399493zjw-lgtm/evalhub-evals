# Golden reader patterns

These are optional source-shape guides. They do not create rigid CEO and RSI modes, fixed table counts, or fixed column counts.

## CEO-style operating results

This shape is useful when each model has one final ranking metric plus operating, survival, resource, or time summaries.

- Put the final comparable metric in the compact leaderboard.
- Put remaining official fields in one or more cross-model tables.
- Combine fields when the table remains readable; split them by purpose when clearer.
- Preserve all official models and source-backed values.
- Use `题目默认 harness` when all models use the same unnamed task-provided harness.
- Show a time series only when every point comes from the source.

```markdown
| 排名 | 模型 | 官方总分 | Harness |
| ---: | --- | ---: | --- |
| 1 | Official Model A | 22148357 | 题目默认 harness |
| 2 | Official Model B | 17864022 | 题目默认 harness |

| 模型 | 完成运行 | 最长存活天数 | 执行成本（USD） |
| --- | ---: | ---: | ---: |
| Official Model A | 3 / 3 | 500 | 83.20 |
| Official Model B | 3 / 3 | 441 | 75.10 |
```

If one readable table can hold both scores and execution fields, that is also acceptable. Do not turn participants into separate tables or tabs.

## RSI-style multi-benchmark results

This shape is useful when one primary score summarizes several official benchmarks or scenarios.

- Keep the documented primary score in the leaderboard.
- Transpose the official benchmark payload into a cross-model matrix.
- Resource or cost fields may share that matrix or use another cross-model table.
- Preserve source formatting and exact source values; do not reconstruct hidden precision.
- Use `—` and a nearby coverage note when the source genuinely omits a cell.

```markdown
| 排名 | 模型 | 官方汇总 | Harness |
| ---: | --- | ---: | --- |
| 1 | Official Model A | 27.964107 | 题目默认 harness |
| 2 | Official Model B | 24.103221 | 题目默认 harness |

| 模型 | Code repair | Terminal tasks | 执行成本（USD） |
| --- | ---: | ---: | ---: |
| Official Model A | 35% | 5.62% | 41.20 |
| Official Model B | 31% | 4.49% | 38.90 |
```

## Task cases

- Show at most five selected cases.
- Keep each displayed original prompt complete.
- Give each displayed case a complete faithful Chinese translation.
- Non-displayed tasks do not need a translation.
- Long text remains complete; visual folding belongs to the platform.

## Machine-readable compatibility

When the repository also stores supplementary tables or charts, keep stable IDs and shared metadata consistent across participants. Those files support ingestion and compatibility; the Markdown page still contains the human-readable cross-model result table itself.
