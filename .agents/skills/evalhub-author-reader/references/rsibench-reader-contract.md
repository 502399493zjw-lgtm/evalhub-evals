# RSIBench Markdown reader reference

RSIBench-Data is the content-architecture comparison page for rebuilt EvalHub detail pages. It is a reference for information order and completeness, not a fixed template for column counts or result-table families.

## Reader sequence

The platform owns the Hero. The authored Markdown normally follows:

1. `榜单`
2. `官方分项结果`
3. `关于此评测`
4. Optional source-backed observations, method details, or figures
5. `题目案例`
6. `一手资料`

Equivalent benchmark-specific headings are allowed. Do not repeat the Hero.

## Official results

The leaderboard stays compact: rank, model, primary official metric, and Harness when useful. Do not add a “口径” column.

The official component section contains one or more complete cross-model tables. Authors may combine or separate score, resource, execution, time, token, cost, and judging fields according to readability. The rules that matter are:

- preserve every official participant and source-backed value;
- compare models on a shared row axis whenever possible;
- never create one result table or tab per model;
- never let an official image suppress the comparable Markdown data;
- keep model names as plain text;
- label a shared unnamed task-provided default as `题目默认 harness`.

There is no mandatory five-column leaderboard, seven-column score table, three-column resource table, or any other fixed shape.

## Task cases

Show at most five tasks selected across authored order, including first and last when at least two are shown. Only displayed cases require `translation`. Each displayed case contains the complete source prompt and a complete faithful Chinese translation, including every instruction, constraint, list, code block, command, path, filename, literal, placeholder, formula, number, unit, and example.

## Long tables

Keep all rows in Markdown. A preview should:

- show no fold control for at most eight body rows;
- initially show eight rows when there are more;
- expand to every remaining row and allow collapse;
- retain horizontal access on narrow screens.

## Lightweight regression comparison

When revising an existing page, compare old and new versions for accidentally missing sections, models, source rows, figures, or selected task cases. Also check heading continuity and per-model table fragmentation. Regrouping columns, combining tables, or splitting one wide table is allowed when the result is clearer and no source data is lost.

Run:

```bash
node .agents/skills/evalhub-author-reader/scripts/report-reader-structure.mjs \
  --reference evals/rsibench-data/eval.yaml \
  evals/<slug>/eval.yaml
```

The script checks structural readiness and translation coverage. It is not a mandate to copy RSIBench column-for-column and it does not prove factual correctness.
