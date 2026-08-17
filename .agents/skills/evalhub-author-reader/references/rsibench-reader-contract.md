# RSIBench Markdown reader contract

RSIBench-Data is EvalHub's Markdown content-architecture reference. This contract defines the information roles and quality bar for rebuilt detail pages; it does not preserve the old structured renderer, fixed native modules, or frontend-derived per-model tabs.

## Canonical content sequence

The platform owns the Hero. The authored Markdown begins at H2 and follows this reader flow:

1. `榜单`: one complete official model matrix containing rank, aggregate, compatible submetrics, harness, and source-backed execution/cost fields.
2. `官方分项结果`: formula, coverage, protocol or base-model boundaries, and source-published interpretation that should not become a second participant table.
3. `关于此评测`: plain-language purpose, actual protocol, scoring, comparison boundary, and limitations.
4. Optional evidence-backed observations and resources.
5. `题目案例`: at most five complete originals with complete faithful Chinese translations.
6. `一手资料`: credential-free HTTPS primary sources.

Equivalent benchmark-specific headings are allowed when their meaning is clear and their order remains coherent. Do not repeat the Hero or add empty filler sections.

## Ownership map

| Reader surface | Sole data owner | Required authoring rule |
| --- | --- | --- |
| Hero | top-level `eval.yaml` metadata and `references` | Do not repeat it in Markdown. |
| Official model matrix | reviewed `published-results/*.json` plus its pinned source snapshot | One row per model; one column per compatible official aggregate, submetric, execution, judging, time, cost, token, and harness field. |
| Protocol explanation | reviewed primary sources and `eval.yaml` protocol | Explain what runs, how it is judged and aggregated, and the comparison boundary without inventing facts. |
| 题目案例 | deterministically selected `tasks[]` plus any real task-linked run evidence | At most five cases; complete original and complete faithful Chinese translation for each displayed case. |
| 一手资料 | source ledger and result provenance | Use primary-source HTTPS links; figures may coexist with tables but never replace them. |

Machine-readable rankings and supplementary views remain in `published-results` for provenance and compatibility. Real result `task_results` and `showcases` may still supply task-linked outputs, trajectories, and evidence. The Markdown body must not manufacture those artifacts and must not depend on frontend derivation to produce its official comparison table.

## Official result matrix

RSI-style multi-benchmark results are transposed into one wide table:

- one row per source-published model;
- plain-text model names, with no Markdown links or anchors;
- the official aggregate and every compatible source-published benchmark/scenario as columns;
- source-published harness names preserved as secondary metadata;
- `题目默认 harness` only when every participant uses the same task-provided default and the source does not name variants;
- exact source formatting retained when it communicates precision;
- `—` for a source-missing cell, accompanied by a coverage note;
- no per-model tables, per-model result tabs, or hidden dependency on an official image.

If two source tables have the same participant axis and snapshot, join them only by exact participant identity and stable metric meaning. If they use genuinely different protocols or incompatible row axes, keep them as separately labeled protocol tables and explain the boundary.

## Task-case selection and translation

The repository preview selects at most five tasks evenly across authored order, including the first and last when at least two cases are displayed. For `n` tasks and `k = min(5, n)` cases, select indices `round(i * (n - 1) / (k - 1))` for `i = 0..k-1`. A live reader may prioritize tasks with real public task evidence and fill the remaining slots with the same deterministic rule.

Only displayed cases require `translation`; non-case tasks may omit it. Each displayed case must preserve the complete source `prompt` and translate every instruction, constraint, warning, paragraph, list, code block, command, path, filename, literal, placeholder, formula, number, unit, and example. A synopsis, translator-added omission marker, or link-only substitute fails readiness. Source-authored ellipses are valid when present in the pinned original.

## Long-table interaction

The stored Markdown always keeps the complete source-backed row set. In a real preview:

- a table with at most eight body rows has no fold control;
- a table with more than eight rows initially exposes exactly eight;
- its control says `展开其余 N 行` with the true hidden count;
- expansion exposes every stored row and offers `收起至 8 行`;
- narrow layouts retain horizontal access to every column.

This presentation rule never authorizes row deletion, table splitting, participant omission, or a fake summary row.

## Acceptance comparison

Compare every rebuilt page with RSIBench-Data at three levels:

| Level | Must be equivalent | May differ |
| --- | --- | --- |
| Data contract | Markdown renderer; source-backed official model matrix; at most five selected cases with full translations; preserved machine-readable provenance | Counts of models, metrics, tasks, facts, figures, and sources |
| Content semantics | Results first; protocol and limitations explained; selected cases; primary sources; no repeated Hero | Benchmark-specific headings and prose |
| Interaction | Eight-row fold behavior; complete expansion; narrow-table access; task selection | Total content height and source-justified tables with genuinely different row axes |

Run the deterministic preflight before preview:

```bash
node .agents/skills/evalhub-author-reader/scripts/report-reader-structure.mjs \
  --reference evals/rsibench-data/eval.yaml \
  evals/<slug>/eval.yaml
```

The preflight checks Markdown readiness, official matrix shape, plain model labels, and selected-case translation coverage. It does not prove factual correctness. Repository validation, source-ledger review, result provenance review, and staging interaction checks remain required.
