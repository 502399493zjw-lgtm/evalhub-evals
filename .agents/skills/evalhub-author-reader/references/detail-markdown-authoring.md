# Generic EvalHub detail Markdown authoring

Use this reference for every new or updated `detail_profile.markdown`. It defines a reusable reader-document contract, not an outline for one specific benchmark.

## Page boundary

The platform renders the standard Hero from evaluation metadata and the interactive task-case browser from structured task evidence. The author owns one complete Markdown editorial document between them.

```yaml
detail_profile:
  source_kind: upstream_publication # or evalhub_native
  markdown: |-
    ## Results
    ...
```

- Start the first visible section at `##`.
- Do not repeat the evaluation name as an H1.
- Do not recreate the Hero's description, author, source links, tags, counts, or actions.
- Do not recreate task tabs, prompt/translation panels, model-result tabs, empty task-result states, or replay lists in Markdown; keep complete cases in `tasks[]` and their linked evidence.
- Do not mix `markdown` with legacy structured detail fields.
- Do not add stable module IDs, HTML, MDX, components, CSS classes, or layout instructions.
- Use headings, paragraphs, lists, blockquotes, pipe tables, fenced code, links, images, and horizontal rules that remain useful as plain Markdown.

## Build from evidence, not from slots

Before drafting, map each reader claim to the source ledger and classify it as one of:

- **official**: directly displayed or stated by the first-party source;
- **transcribed**: copied faithfully from a reviewed source artifact;
- **derived**: reproducibly calculated from named source inputs;
- **real run**: emitted by an actually completed run;
- **unverified**: unsupported or not checked, and therefore omitted from the reader document unless the uncertainty itself is material.

Never turn a paper aggregate, design mock, sample result, or prose description into a real-run trace. Do not fill a missing section with inferred numbers or generic prose.

## Choose an adaptive outline

Use the smallest outline that explains the reviewed evidence. These are reader concerns, not mandatory module names.

When comparable results exist, prefer this information order:

1. primary leaderboard or result summary;
2. component, subgroup, scenario, or trend results;
3. score meaning and formula;
4. what is evaluated and why it matters;
5. fixed protocol or run flow;
6. task-family context or source-backed research observations, when useful;
7. resources, limitations, and first-party sources.

For an evaluation without a public leaderboard, begin with the goal and protocol, then show available baselines or examples. For a qualitative, human-reviewed, safety, multimodal, or environment benchmark, rename or omit sections so the document describes the actual evidence shape. Do not create a leaderboard merely because the template supports tables.

Useful generic headings include:

```markdown
## Results
### Overall result
### Component results
### How to read the score

## About this evaluation
### Evaluation goal
### Fixed protocol
### Run flow

## Research observations

## Resources and sources
### Evidence boundary and limitations
### Primary sources
```

Localize headings to the document language. Merge short sections when that improves reading flow.

## Make the result legible early

- Put the strongest comparable result table or official result figure near the top when one exists.
- Explain provenance immediately before or after the result, including snapshot date and whether values are official or derived.
- Put score semantics close to the first result table, not several screens later.
- Keep a source-published result image beside the result or interpretation it supports. Put a protocol diagram beside the protocol. Put a task or trajectory figure beside the corresponding case or observation.
- Do not collect unrelated images into a gallery. Every image needs descriptive alt text and a source-backed caption.
- Prefer an accessible Markdown table over an image of a table when the underlying cells are available.

## Numeric display policy

Reader-facing scores, rates, percentages, rewards, accuracies, pass rates, and derived comparison values use **at most one decimal place**:

- `27.317` renders as `27.3`;
- `44.17%` renders as `44.2%`;
- `50.00%` renders as `50%`, not `50.0%`;
- `22.005` renders as `22` when standard rounding produces an integer.

Apply conventional rounding to the unrounded source value. Do not truncate. Keep raw source precision in `published-results`, source snapshots, formulas, or other machine-readable evidence when the contract needs it. Ranking and derived calculations use those unrounded values, not the rounded Markdown display.

If display rounding makes different entries look tied, preserve the source-defined order and say that the displayed values are rounded and do not redefine ranking. Do not add hidden decimals to break a visual tie.

This display rule does not reduce necessary precision for dates, versions, protocol constants, token counts, elapsed time, monetary cost, uncertainty, or source identifiers unless they are themselves the evaluation's score. Preserve a source's uncertainty notation when rounding it would change the scientific claim.

## Tables

- Use one header row and short, explicit labels.
- Put identity or category columns first and comparable numeric columns after them.
- Right-align numeric columns with `---:`.
- Use `—` for genuinely missing values and explain that it does not mean zero.
- State whether rows are ranked, source order, or reference-only.
- State the source boundary and snapshot date near official result tables.
- Label derived rows or columns in prose; never call a derived value official.
- Keep large tables complete when the source supports them. Horizontal scrolling is a renderer concern, not a reason to delete evidence.
- Do not manually split, truncate, or label “page 1” in a leaderboard. Ranking tables longer than 10 rows are paginated by the renderer at 10 rows per page; shorter tables remain unpaginated.

## Protocol, tasks, and sources

Explain enough for a new reader to answer:

- What does the evaluated system receive and produce?
- What remains fixed and what may the participant change?
- Who or what judges the output?
- How are per-task values aggregated into the primary score?
- Which version, dataset, environment, budget, and comparison boundary apply?
- What task families or interactions does the structured task browser represent?
- What important limitation prevents overgeneralization?

Use a short numbered list for a genuine sequence. Use a table for repeated field comparisons. Use prose for caveats and interpretation.

End with credential-free HTTPS first-party links. Distinguish a source publication from an EvalHub rerun. If no rerun occurred, say so plainly.

## Preflight

Run:

```bash
python3 .agents/skills/evalhub-author-reader/scripts/check_detail_markdown.py evals/<slug>/eval.yaml
npm run validate
```

Then preview `/e/<slug>` when the platform is available and verify:

- the Hero is present exactly once;
- the body begins below it and contains no duplicate H1;
- the primary result is easy to find;
- score and percentage displays use at most one decimal;
- tables remain readable at desktop and mobile widths;
- a leaderboard with more than 10 rows exposes working 10-row pagination without losing rows;
- task tabs switch complete prompts, long prompts expand, task-level model tabs appear only when evidence exists, and other replays remain separate;
- images load, have useful alt text, and sit beside relevant content;
- links work and no unsupported placeholder content remains.
