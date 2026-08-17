# Golden reader patterns

Use the pattern that matches the reviewed source. These are data-shape examples, not permission to invent missing values or copy the example numbers into a submission.

## Pattern A: long-horizon operating benchmark (CEO-style)

Use this when each participant has one final ranking score plus a source-published run summary and/or a real time series.

- Put the final comparable value in `score`.
- In machine-readable structured results, give every participant's run-summary table the same `id`, `type`, `title`, `label`, and `columns`.
- Add a `line_chart` only when the source publishes each plotted point or a real EvalHub run emitted it. A start value and final value do not justify an interpolated curve.
- Keep participant-specific values in rows, series names, and points. Do not encode a model name into the shared view ID.
- Preserve every source-published participant in `published-results`; the detail page may present a compact subset in a particular reader control, but the stored official leaderboard must not be hand-truncated to three or four models.
- In the Markdown body, keep a compact cross-model leaderboard. Use a separate cross-model run-summary table when execution, resource, time, cost, or survival fields answer a distinct reader question or would make the ranking table unwieldy. If the source splits one logical family across sibling tables, join that family only by exact participant identity; do not create one tab or table per model.
- Keep model names as plain text. When all CEO-style runs use the task-provided default harness and the source does not distinguish variants, label it `题目默认 harness` as secondary metadata.
- An official run-summary image may appear beside the table for provenance, but it does not replace or suppress the text table.
- A preview may show only the first eight body rows until the reader expands it, but that presentation limit never authorizes deleting participants or dropping summary columns.

```markdown
| 排名 | 模型 | 官方总分 | harness |
| ---: | --- | ---: | --- |
| 1 | Official Model A | 22148357 | 题目默认 harness |
| 2 | Official Model B | 17864022 | 题目默认 harness |

| 模型 | 完成运行 | 最长存活天数 |
| --- | ---: | ---: |
| Official Model A | 3 / 3 | 500 |
| Official Model B | 3 / 3 | 441 |
```

```json
{
  "participant": { "model": "Source-published model name" },
  "score": 22148357,
  "supplementary_views": [
    {
      "type": "metric_table",
      "id": "official-run-summary",
      "label": "运行摘要",
      "title": "官方运行摘要",
      "columns": ["运行数", "完成运行", "最长存活天数"],
      "rows": [{ "cells": [3, 3, 500] }],
      "note": "Transcribed from the reviewed official result artifact."
    },
    {
      "type": "line_chart",
      "id": "official-cash-process",
      "label": "收入过程",
      "title": "官方现金过程",
      "x_label": "模拟日",
      "y_label": "现金（USD）",
      "series": [
        {
          "name": "Source-published model name",
          "points": [
            { "x": 0, "y": 1000000 },
            { "x": 100, "y": 1624000 },
            { "x": 500, "y": 22148357 }
          ]
        }
      ],
      "note": "Every point appears in the reviewed source artifact."
    }
  ]
}
```

If the source only publishes the final score and summary, omit `official-cash-process`. Do not manufacture a process curve to make the Markdown body or a legacy module look complete.

## Pattern B: multi-benchmark aggregate (RSI-style)

Use this when one primary score aggregates several stable benchmark or scenario rows for each participant.

- Put the documented aggregate in `score` and explain its formula in `detail` when needed.
- In machine-readable structured results, use one stable table ID across participants.
- Keep the structured table `title`, `label`, and `columns` byte-for-byte identical across participants.
- Keep its first column as the stable row key. Every participant must use the same complete row-key set before a legacy reader can safely derive a comparison.
- Preserve source formatting and exact numeric values in separate columns when the source provides both. Do not reverse-engineer a hidden precision value from a rounded display string.
- In the Markdown body, keep the aggregate in a compact leaderboard and transpose the source-backed benchmark/scenario payloads into one cross-model score table. Keep resource or execution totals in a separate cross-model table when they form a distinct family. Do not duplicate aggregate and harness into the score table merely to make one wide matrix, and do not emit per-model tabs.
- Keep official figures as adjacent source artifacts; their presence never filters out the normalized table.

```markdown
| 排名 | 模型 | 官方汇总 | harness |
| ---: | --- | ---: | --- |
| 1 | Official Model A | 27.964107 | 题目默认 harness |
| 2 | Official Model B | 24.103221 | 题目默认 harness |

| 模型 | Code repair | Terminal tasks |
| --- | ---: | ---: |
| Official Model A | 35% | 5.62% |
| Official Model B | 31% | 4.49% |
```

```json
{
  "participant": { "model": "Source-published model name" },
  "score": 27.964107,
  "detail": "Macro-average of the six exact source-published percentages.",
  "supplementary_views": [
    {
      "type": "metric_table",
      "id": "official-benchmark-breakdown",
      "label": "分榜成绩",
      "title": "官方分榜成绩",
      "columns": ["分项", "官网显示", "成功/试次", "精确分数"],
      "rows": [
        { "cells": ["Code repair", "35%", "35/100", 35] },
        { "cells": ["Terminal tasks", "5.62%", "5/89", 5.617978] }
      ],
      "note": "Auxiliary official metrics; they do not define independent rankings."
    }
  ]
}
```

If one participant is missing a source-published row, use `—` with a coverage note rather than padding a value. If it uses a genuinely different protocol, do not place it in the same Markdown matrix: record the boundary and use a separately labeled protocol table. A legacy structured reader may fall back to the original per-participant payloads instead of deriving a misleading comparison.

## Task-case pattern

Task examples are independent of aggregate published results:

- `prompt` is the one task statement: what runs and what the page shows. For an upstream task it is the complete source-published original, verbatim from the pinned commit. Long text is intentionally stored in full; the platform owns default folding and expansion.
- `run_spec` holds EvalHub's own run procedure and is never rendered, so nothing a reader needs may live only there.
- Select at most five displayed cases deterministically across authored order, including the first and last when at least two are shown; a live reader may prioritize cases with real public evidence before filling the remaining slots.
- Require `translation` only for those displayed cases. Each one must translate the complete original faithfully, preserving all instructions, constraints, warnings, paragraphs, lists, code, commands, paths, filenames, literals, placeholders, formulas, numbers, units, and examples. A summary, translator-added omission marker, or link-only substitute fails readiness. Non-case tasks may omit `translation`.
- Real `task_results` or task-linked showcases may provide model tabs. Never convert leaderboard aggregates, paper prose, or a design mock into fake task outputs or execution traces.
- Do not add author-supplied “view prompt source” or “view official score source” buttons. Global sources belong in `detail_profile.resources` and result provenance belongs in `submission.source`.

## Shared-view preflight

Before opening a PR, group every `published-results` supplementary view by `id` and compare:

| View type | Metadata that must match across participants | Values that may differ |
| --- | --- | --- |
| `metric_table` | `type`, `id`, `title`, `label`, `columns` | `rows`, `note` |
| `line_chart` | `type`, `id`, `title`, `label`, `x_label`, `y_label` | `series`, `points`, `note` |

The repository validator enforces this contract for new authored views. A mismatch is a content-model error, not a frontend styling issue.
