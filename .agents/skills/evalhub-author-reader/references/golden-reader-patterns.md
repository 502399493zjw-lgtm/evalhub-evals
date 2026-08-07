# Golden reader patterns

Use the pattern that matches the reviewed source. These are data-shape examples, not permission to invent missing values or copy the example numbers into a submission.

## Pattern A: long-horizon operating benchmark (CEO-style)

Use this when each participant has one final ranking score plus a source-published run summary and/or a real time series.

- Put the final comparable value in `score`.
- Give every participant's run-summary table the same `id`, `type`, `title`, `label`, and `columns`.
- Add a `line_chart` only when the source publishes each plotted point or a real EvalHub run emitted it. A start value and final value do not justify an interpolated curve.
- Keep participant-specific values in rows, series names, and points. Do not encode a model name into the shared view ID.
- Preserve every source-published participant in `published-results`; the detail page may present a compact subset in a particular reader control, but the stored official leaderboard must not be hand-truncated to three or four models.

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

If the source only publishes the final score and summary, omit `official-cash-process`. The platform renders the remaining modules and their empty states; an author must not manufacture a process curve to make the page look complete.

## Pattern B: multi-benchmark aggregate (RSI-style)

Use this when one primary score aggregates several stable benchmark or scenario rows for each participant.

- Put the documented aggregate in `score` and explain its formula in `detail` when needed.
- Use one stable table ID across participants.
- Keep the table `title`, `label`, and `columns` byte-for-byte identical across participants.
- Keep the first column as the stable row key. Every participant must use the same complete row-key set before the platform can safely derive one comparison tab per benchmark.
- Preserve source formatting and exact numeric values in separate columns when the source provides both. Do not reverse-engineer a hidden precision value from a rounded display string.

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

If one participant is missing a source-published row or uses a genuinely different protocol, do not pad it. Record the boundary and keep the source-faithful view; the platform must fall back to the original per-participant tables instead of deriving a misleading comparison.

## Task-case pattern

Task examples are independent of aggregate published results:

- `prompt` remains the exact executable protocol.
- `display_prompt` contains the complete source-published original for every upstream task. Long text is intentionally stored in full; the platform owns default folding and expansion.
- `translation` is complete when present.
- Real `task_results` or task-linked showcases may provide model tabs. Never convert leaderboard aggregates, paper prose, or a design mock into fake task outputs or execution traces.
- Do not add author-supplied “view prompt source” or “view official score source” buttons. Global sources belong in `detail_profile.resources` and result provenance belongs in `submission.source`.

## Shared-view preflight

Before opening a PR, group every `published-results` supplementary view by `id` and compare:

| View type | Metadata that must match across participants | Values that may differ |
| --- | --- | --- |
| `metric_table` | `type`, `id`, `title`, `label`, `columns` | `rows`, `note` |
| `line_chart` | `type`, `id`, `title`, `label`, `x_label`, `y_label` | `series`, `points`, `note` |

The repository validator enforces this contract for new authored views. A mismatch is a content-model error, not a frontend styling issue.
