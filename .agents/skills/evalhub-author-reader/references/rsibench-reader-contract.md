# RSIBench reader contract

RSIBench-Data is the single EvalHub detail-page architecture reference. This contract governs page structure; benchmark-specific result shapes and content volume may differ without creating a second architecture.

## Canonical module signature

The platform-owned order is fixed:

1. `hero`
2. `leaderboard` (`榜单`)
3. `official-breakdown` (`官方分项结果`)
4. `about` (`关于这套评测`)
5. `task-cases` (`题目案例`)
6. `resources` (`资料与分析`)
7. `footer`

An author never changes, repeats, or reorders these modules. An unsupported optional data block gets the platform empty state or disappears inside its owning module; it never becomes a benchmark-specific H2.

## Ownership map

| Reader surface | Sole data owner | Required authoring rule |
| --- | --- | --- |
| Hero | top-level `eval.yaml` metadata and `references` | Do not repeat it in prose. |
| 榜单 | `published-results/*.json > results[].score` and participant metadata | Preserve every reviewed participant and source value. |
| 官方分项结果 | shared `results[].supplementary_views` contracts | One participant row axis uses one unified metric table; one logical view ID has identical metadata across participants. |
| 关于这套评测 | structured `detail_profile` | Explain protocol, score, facts, limitations, tables, and figures here only. |
| 题目案例 | selected `tasks[]` plus real task-linked run evidence | Keep stable IDs and complete source prompts for all tasks. Require a faithful Chinese full-text translation only for tasks actually selected into the case tabs; never substitute a summary or manufacture outputs. |
| 资料与分析 | `detail_profile.resources_note`, `resources`, and source provenance | Use primary-source HTTPS cards; do not recreate them as a Markdown link list. |

## Structured profile baseline

Every new or substantially revised source-backed eval uses these core fields:

- `source_kind`
- `summary.plain_language`
- `summary.why_it_matters`
- two to six `method_steps`
- `score_interpretation`
- one to six `caveats`
- one to six `resources`

Use `overview_note`, `key_facts`, `overview_tables`, `figures`, and `resources_note` whenever reviewed sources support them. Optional means evidence-dependent, not a layout choice. Never create an empty table, synthetic figure, unsupported fact, or filler resource to match RSIBench's content volume.

## Benchmark-specific information mapping

- Final rankings belong only in `score`; they never appear again in `detail_profile`.
- Participant run summaries, scenario matrices, sub-benchmarks, rubric components, token statistics, and source-published trends belong in shared `supplementary_views` when the result artifact supports them.
- Metrics attached to the same participant and source boundary belong in one `metric_table`, even when the source visually groups performance, execution, judging, pricing, cost, or token columns. Split views only for a different row axis, a different visualization type, or a source-defined semantic boundary that cannot be represented faithfully in one table; record the reason in the source ledger.
- Fixed protocol matrices, action spaces, task-family inventories, scoring weights, and environment definitions belong in `overview_tables`.
- Protocol diagrams and source-published analytical figures belong in `figures`.
- Reproduction steps are `method_steps` when they explain the official protocol. EvalHub-only execution instructions belong in `run_spec` and README, not the reader page.
- Material sampling, judging, version, license, cost, and comparison boundaries belong in `caveats`.

## Markdown exception

`detail_profile.markdown` is allowed only when the source ledger identifies a material reader construct that the bounded structured schema cannot represent. The PR must name that construct and why omission would misstate the benchmark. Styling preference, existing prose, desire for custom headings, and convenience are not sufficient reasons.

A Markdown page suppresses the platform-native leaderboard, official breakdown, task controls, resource cards, and footer module. It therefore cannot pass a request for RSIBench-native parity. When Markdown is nonetheless justified, use exactly these H2 headings and order: `榜单`, `官方分项结果`, `关于这套评测`, `题目案例`, `资料与分析`.

## Long-table interaction

The storage layer always keeps the complete source-backed row set. In a real preview:

- a table with at most eight body rows has no fold control;
- a table with more than eight rows initially exposes exactly eight;
- its control says `展开其余 N 行` with the true hidden count;
- expansion exposes every stored row and offers `收起至 8 行`;
- narrow layouts retain horizontal access to every column.

This presentation rule never authorizes row deletion, table splitting, participant omission, or a fake summary row.

## Acceptance comparison

Compare every rebuilt page with RSIBench-Data at three levels:

| Level | Must be identical | May differ |
| --- | --- | --- |
| Data contract | Structured renderer; module signature and order; field ownership; 100% full-text Chinese translation coverage for the selected task cases | Counts of results, tasks, non-case translations, facts, tables, figures, and resources |
| DOM semantics | One H1; canonical H2 order; native tabs/cards/empty states | Benchmark names, table columns, labels, and prose |
| Interaction | Eight-row fold behavior; task selection; resource links; narrow overflow; one unified participant-metric table per shared row axis | Source-justified tabs with different row axes or visualization types; total content height |

Run the deterministic preflight before preview:

The preflight reproduces the evidence-free repository preview selector: at most five tasks evenly spaced across authored order, including the first and last. It reports the selected case IDs and validates translation coverage only for that set. If a live page has real task-linked evidence, inspect its evidence-first case tabs separately because they may replace one or more preview cases.

```bash
node .agents/skills/evalhub-author-reader/scripts/report-reader-structure.mjs \
  --reference evals/rsibench-data/eval.yaml \
  evals/<slug>/eval.yaml
```

A matching signature does not prove factual correctness. Repository validation, source-ledger review, result provenance review, and staging interaction checks remain required.
