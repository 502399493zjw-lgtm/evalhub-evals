# EvalHub content and evidence contract

Use this reference while authoring every new or updated evaluation. It is intentionally self-contained because this skill ships with the standalone evals repository.

## Detail-page layers and order

The reader page has three visible layers:

1. the platform-owned standard Hero, produced from evaluation metadata;
2. one author-owned Markdown editorial document from `eval.yaml > detail_profile.markdown`;
3. the platform-owned interactive task-case browser, produced from `tasks[]`, real/source-matched task evidence, and other replays.

Reviewed `published-results/*.json`, real-run `task_results`, and `showcases` remain evidence inputs and machine-readable records. When their facts are discussed in the reader document, preserve their provenance and never imply that an upstream publication was an EvalHub run.

The Markdown outline is adaptive. A result-rich benchmark normally leads with its primary result and breakdowns; a benchmark without comparable results may lead with its goal and protocol. Completeness means that every useful supported fact has a clear place, not that every possible section exists. Never invent a chart, task output, trace, table row, image, or empty module.

## `detail_profile` contract

```yaml
detail_profile:
  source_kind: evalhub_native # or upstream_publication
  markdown: |-
    ## Results

    Source-backed reader content starts here.
```

`markdown` is a non-empty complete editorial document below the Hero and before the task-case browser. It starts at `##`, does not repeat the evaluation name or statically duplicate task panels, and uses ordinary Markdown. A Markdown profile is strict and must not contain legacy structured detail fields. Do not add module IDs, HTML, MDX, React, CSS, or layout instructions.

Use `references/detail-markdown-authoring.md` for the adaptive outline, image placement, table rules, score-display precision, and preview checklist. Credential-free HTTPS sources and images are allowed. Omit unsupported optional content, `TODO`, `待补`, literal `placeholder`, and `example.com` scaffold values.

## Task identity contract

Every `eval.yaml > tasks[]` entry in a repository submission must declare a non-empty `id` matching `^[a-z0-9][a-z0-9-]{0,63}$`. IDs must be unique within the eval. Treat each ID as a durable reference: keep it unchanged when revising the wording or fixture for the same logical task, and use a new ID only when the task identity changes. Compatibility schemas may accept an omitted historical task ID, but the standalone repository authoring validator rejects missing, whitespace-only, malformed, and duplicate IDs.

`prompt` is the one task-statement field: the executable task text and the exact text the detail page renders. There is no display fallback, so an abridged `prompt` reads as an abridged question on the page. For `evalhub_native` it is the checked-in executable protocol; for `upstream_publication` it is the complete source-published original transcribed character-for-character from the pinned `upstream.commit`, including any unreplaced upstream template placeholders. Never replace it with a summary, excerpt, `[…]`, `[...]`, or a link-only description. It has no length cap and, once parsed from YAML, is preserved character-for-character by schema and sync; do not trim it. EvalHub's own reproduction procedure — fixed run configuration, evidence packaging, redaction rules, the concrete values behind upstream placeholders — belongs in the optional `run_spec`, which reaches whoever runs the eval through this repository and is never rendered on the detail page; keep reader-facing task content out of it. Add a concise `label` (1–80 characters) for the task tab and, when a faithful Chinese rendering is available, the complete translation in `translation` (1–30,000 characters). Long display prompts remain complete in HTML/DOM and are only visually collapsed by the platform with an expand/collapse control. The task panel does not render dedicated “view prompt source” or “view official result source” actions; keep provenance in the page source areas, supplementary-view declarations, captions, and resources.

The platform, not Markdown, owns the task tabs, original/translation grouping, long-prompt expansion, per-task model-result tabs, honest omission of empty result areas, and the separate other-replays fold. Markdown may explain task families or source-backed research observations, but it must not restate each prompt as a static “题目案例 / 任务案例 / Task cases” section.

When an upstream publication provides a task/scenario row that reliably matches the task ID or label, the platform may summarize at most four participants from the public leaderboard inside that task panel. Authors must preserve the real row in `supplementary_views`; they must not manufacture upstream `task_results`, per-task output, or traces. If no row matches reliably, leave the task result area empty.

## Built-in runner and protocol revision contract

This section applies only to EvalHub's built-in scorer implementation; it does not authorize EvalHub CI, preview services, or platform servers to execute a submitted custom runner. For `runner: builtin`, the scorer enum is not a sufficient description of behavior. Inspect the selected implementation under the EvalHub main repository's `packages/cli/src/scorers/` and the orchestration and aggregation in `packages/cli/src/commands/run.ts`. Confirm normalization, match predicate, per-task points, aggregation, rounding, and the relevant version. When those files are absent from a standalone checkout, the source ledger must include a credential-free HTTPS permalink pinned to an authoritative commit or release; without one, do not publish runner-semantic claims.

`protocol_revision` is a monotonic scoring-protocol version. `translation`, `label`, prose, `detail_profile`, README, citation, and official-baseline corrections that preserve result comparability do not increment it. Changes to task identity, interaction or run procedure, scorer predicate or normalization, aggregation or rounding, trials, primary metric or unit, or tie-break semantics do increment it and require a recorded reason. `prompt` depends on the runner: for `runner: builtin` it is the executable model input, so every change increments; for an `upstream_publication` transcription, correcting it toward the verbatim upstream original does not, because EvalHub does not execute that text. A `run_spec` change always increments, because `external_workflow` contestants follow it by hand.

## Source ledger policy

Each externally checkable claim needs a ledger entry. Prefer sources in this order:

1. checked-in task, runner, test, or release artifact for `evalhub_native`;
2. paper and appendix authored by the benchmark authors;
3. official project/data page;
4. official author organization repository and releases.

Use secondary material only to locate a primary source. If primary sources conflict, record the version/date and use the source that matches the submitted protocol. Keep license, attribution, redistribution, and fixed-version limitations visible in the README. When no independent open license is present, record that observable fact and do not infer permission from file visibility or present the note as a legal conclusion; confirm applicable authorization before publishing third-party material.

The ledger may remain a working review artifact, but every machine-checkable value mapped from it must be final before submission. In particular, `detail_profile` source URLs and upstream `submission.source` metadata cannot contain `TODO`, `待补`, literal `placeholder`, or `example.com`. `submission.source.snapshot_sha256` must be the digest of the exact reviewed artifact, not a repeated or illustrative 64-character hex string.

Facts may be quoted as concise values only when the source states them or they are deterministic counts from the submitted files. Do not turn qualitative prose into a numeric metric.

The ordinary repository content validator checks structure and authoring invariants without executing third-party runners. Maintenance tests exercise validator, schema, vendor, and CI infrastructure only when those contracts change. Neither path fetches or authenticates source URLs, decides whether a license grants particular rights, fact-checks claims, or proves runtime safety, compatibility, or correctness. Source-ledger, license-boundary, factual, provenance, and obvious documentation-consistency review remain manual gates; custom-runner execution and security review do not.

## Result and evidence matrix

| Content | `score` | `supplementary_views` | `task_results` / `showcases` |
| --- | --- | --- | --- |
| Real EvalHub run | One ranking metric | Real run submetrics if produced | Allowed when emitted by the run |
| Upstream official publication | One sourced aggregate | Sourced tables/trends | Forbidden |
| Sample fixture | Schema illustration only | Demo structures only | Demo structures only |

`metric_table` and `line_chart` are explanatory views and never ranking inputs. Give each a stable `id` and short `label` for tabs. Do not infer a curve from a table or invent intermediate points, and never combine numbers from different sources into a new metric.

**Derived comparison tabs.** When several results in one eval publish a `metric_table` with a byte-identical title and column list, the platform aligns them into one cross-participant comparison tab (single-row tables merge into one table; multi-row tables transpose on the first-column key into one table per key). This is presentation-layer reordering under hard constraints: every cell is copied verbatim from the participant's own table with no conversion, interpolation, or gap filling; the reader ranking projection sorts rows descending by the recognized official score for the current submetric (using a precise-score column when present), keeps source order for ties, and places unrecognized scores after recognized scores; this display rank never fabricates or changes a source score and does not alter the overall leaderboard, points, or tie-breaking; the tab renders an explicit "derived, not an upstream table" notice plus a per-row source link; coverage is disclosed whenever fewer participants are loaded than the leaderboard holds; and the whole group falls back to per-participant tables if titles, columns, or key sets disagree. Every participant's original `supplementary_views` payload remains retained under the data contract and is never rewritten or replaced by the derived view. When a reader page also provides an insights figure, its presentation may expose only the derived comparison tabs instead of repeating every per-participant original-table tab.

To make your eval benefit from this, keep the `title` and `columns` of the same logical table **identical across every result you publish**, and put the metric name in the first column when the table has one row per metric. Differing titles are treated as different tables and will not be aligned — which is the safe default, not a bug.

Only the currently published, schema-valid, provenance-reviewed result should feed public result views. Draft, pending, superseded, or malformed payloads are not public evidence. This status concerns the result envelope and its provenance, not the safety or operability of any runner that may have produced it.

## Canonical upstream result envelope

The following is the complete shape of an upstream publication envelope without supplementary views. It is documentation data, not benchmark evidence: replace every illustrative value, URL, retrieval date, and hash with values from the source ledger. `snapshot_sha256` is the lowercase SHA-256 of the exact source artifact that was reviewed. Omit `eval_commit`; the platform binds the merged eval commit when it imports the file.

```json
{
  "eval_id": "benchmark-slug",
  "submission": {
    "kind": "upstream_author_publication",
    "importer_version": "manual-ledger/1",
    "retrieved_on": "2026-08-05",
    "source": {
      "title": "Official benchmark results",
      "url": "https://benchmark.example.org/results.json",
      "snapshot_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  },
  "results": [
    {
      "participant": {
        "model": "Official Model A"
      },
      "score": 88.4,
      "raw_metric": {
        "label": "Official aggregate",
        "value": "88.4"
      },
      "detail": "Source-published aggregate copied from submission.source; not an EvalHub rerun."
    }
  ]
}
```

An upstream envelope must have a numeric primary `score` and must not contain `usage`, `task_results`, or `showcases`. Put each model or source-published participant in `results`; do not combine different source snapshots in one envelope. `importer_version` identifies the reviewed transcription/import procedure and must change when that procedure changes. The authoring gate rejects placeholder importer/source metadata, `example.com` URLs, and obviously repeated example digests.

For a real run envelope, `submission.run_date` must be an actual calendar date in exact `YYYY-MM-DD` form. Shape-only dates such as `2026-02-29` or `2026-04-31` fail repository authoring validation even though the historical runtime parser remains permissive for compatibility.

## Canonical supplementary view shapes

Insert either of these complete objects into a result's `supplementary_views` array only when every displayed value is present in `submission.source` or is explicitly reproducible from it.

Canonical `metric_table`:

```json
{
  "type": "metric_table",
  "id": "official-components",
  "label": "Components",
  "title": "Official component scores",
  "columns": ["Component", "Score"],
  "rows": [
    { "cells": ["Language", 88.4] },
    { "cells": ["Reasoning", 84.1] }
  ],
  "note": "Source-published component values from submission.source; not an EvalHub rerun."
}
```

Canonical `line_chart`:

```json
{
  "type": "line_chart",
  "id": "official-scale-trend",
  "label": "Scale trend",
  "title": "Official score by published model scale",
  "x_label": "Published model scale",
  "y_label": "Score",
  "series": [
    {
      "name": "Official Model A family",
      "points": [
        { "x": "Small", "y": 71.2 },
        { "x": "Medium", "y": 80.3 },
        { "x": "Large", "y": 88.4 }
      ]
    }
  ],
  "note": "Source-published points from submission.source; no intermediate points were inferred."
}
```

For new or updated result files, `id` and `label` are authoring requirements even when a compatibility parser accepts historical payloads without them. The repository validator applies this rule to every `metric_table` and `line_chart` in `sample-result.json` and `published-results/*.json`. An `id` must be non-empty, match `^[a-z0-9][a-z0-9-]{0,63}$`, and be unique within one result; `label` must be 1–80 characters and not whitespace-only. Titles are at most 200 characters and notes at most 2,000. A metric table has 1–20 unique non-empty columns and 1–200 rows; each row must have exactly the declared number of string, finite-number, or null cells. A line chart has 1–12 uniquely named series and 1–500 points per series; every point has a string-or-number `x` and finite numeric `y`, and `x` values are unique within a series.

When the same logical `metric_table` is published for multiple participants, reuse the exact same `id`, `title`, `columns`, and `label` in every result. Use a different `id` for a different logical table. The platform groups by `id` first and abandons the complete derived comparison if any of those four fields differs; it never partially merges a mismatched group. Only historical views without `id` use the compatibility grouping of exact `title`, `columns`, and `label`, so new data must not rely on that fallback. A derived comparison is a display-only rearrangement, retains every source cell verbatim, links every row to its source result, and is labeled `EVALHUB 对齐 · 非来源方原表`. The original per-participant payload remains stored under the data contract; a reader page with an insights figure may omit redundant per-participant original-table tabs and show only the derived tabs.

The authoring validator extends that rule to every shared supplementary-view ID. Across published participants, a shared ID must keep identical `type`, `title`, and `label`; metric tables must also keep identical `columns`, while line charts must keep identical `x_label` and `y_label`. Rows, series, points, and notes may differ. This stricter gate prevents content drift from silently breaking cross-model reader tabs.

There is no dedicated `derived` or `formula` property. If the primary `score` is reproducibly derived, begin the result's `detail` with `Derived:` and include the complete formula and source inputs. If a supplementary value is derived, put the same disclosure in that view's `note`, for example: `Derived: macro_average = (Language + Reasoning) / 2 using the two source-published cells above.` A derived value is never labeled official, and a missing source input means the derived value must be omitted.

## Acceptance checklist

- Source kind and protocol version are explicit.
- The Markdown body starts at `##`, does not duplicate the Hero, and explains the supported result, protocol, score meaning, caveats, and sources needed by this evaluation.
- Every fact, figure, and official result maps to the source ledger.
- No `TODO`, `待补`, literal `placeholder`, `example.com`, repeated example digest, credential-bearing URL, fabricated chart, or implied endorsement remains.
- Every authored run uses a real `YYYY-MM-DD` calendar date.
- Upstream aggregates are clearly attributed and never called an EvalHub rerun.
- Execution traces and outputs come only from real runs.
- Every task declares a non-empty, unique ID matching `^[a-z0-9][a-z0-9-]{0,63}$`; task-result and compare/transcript IDs resolve to it, and each task ID appears in `task_results` no more than the configured `trials` count within one result.
- Main score and supplementary views have distinct roles.
- Every new or updated supplementary view has a unique stable `id`, a short `label`, and a source-backed or explicitly derived payload.
- The same logical cross-participant metric table reuses an exact `id`, `title`, `columns`, and `label`; distinct logical tables use distinct IDs.
- The same logical cross-participant line chart reuses an exact `id`, `title`, `label`, `x_label`, and `y_label`; participant-specific series and points remain source-backed.
- Derived primary scores disclose their formula in `detail`; derived supplementary values disclose it in `note`.
- Unsupported optional content is omitted rather than filled with guesses.
- Reader-facing scores and percentages use at most one meaningful decimal; stored source artifacts and calculations retain the precision required by their data contract.
