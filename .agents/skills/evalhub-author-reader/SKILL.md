---
name: evalhub-author-reader
description: Research, author, revise, and verify the readiness of one source-backed EvalHub evaluation submission with a declared cover, visible source-backed Harness identity, a Markdown-only detail page, complete official result tables, and fully translated selected task cases.
---

# EvalHub Author Reader

Build one reviewable EvalHub evaluation package. This skill owns source research, repository content, Markdown structure, result transcription, selected task cases, and readiness interpretation. Repository workflows own validation implementation and execution. The platform owns page styling and interaction.

## Read before editing

Read these files completely:

1. `../../../CONTRIBUTING.md`
2. `../../../llms.txt`
3. `references/content-and-evidence-contract.md`
4. `references/rsibench-reader-contract.md`
5. The target `evals/<slug>/eval.yaml`, `README.md`, result files, and task fixtures when updating an existing eval

Use `references/golden-reader-patterns.md` only as a shape guide. CEO-style and RSI-style are examples of source shapes, not rigid modes or fixed column counts.

## Scope

Confirm only what cannot be learned safely: whether this is a new eval or an update, the primary source, and the target slug. Work inside exactly one `evals/<slug>/` unless the request explicitly changes a shared contract. Do not rename an existing slug or edit `.github/CODEOWNERS` for an eval submission.

Keep these identities separate:

- **Public author**: the owner of the source GitHub repository.
- **Maintainer**: the single GitHub handle in `AUTHORS`.
- **Submitter**: the account opening the pull request.

For an existing eval, preserve `AUTHORS` byte-for-byte. The repository PR gate remains the authority for permissions. Do not merge or deploy unless the user asks.

## Stage 1: inspect the source

Read first-party sources before writing. Prefer the official repository, paper, project page, task definitions, and official result artifact over mirrors or summaries.

Keep a lightweight working ledger:

| Claim or artifact | Primary URL or repository path | Version or date | Target section |
| --- | --- | --- | --- |

Every published statement, result value, table, figure, Harness identity, and cover provenance must be traceable to this ledger. Omit unsupported optional content instead of guessing. Do not leave `TODO`, `待补`, literal `placeholder`, `example.com`, fabricated values, or credential-bearing URLs.

Do not infer that two sources describe the same benchmark from a shared or similar title. Before linking a paper, project, dataset, or repository as the same work, compare its authors or owners, game or domain version, task definition, method, repository and dataset links, and explicit cross-references from first-party sources. Without affirmative identity evidence, treat the sources as distinct and do not imply a relationship.

Separate the cover from evidence figures. For every new eval, create one reviewable local raster cover and declare it through top-level `cover`; do not leave the Hero without a cover merely because the upstream source lacks one. The displayed cover must fit 懂模帝's established pixel-art visual language: a 16:9 scene with intentional visible pixels, hard-edged silhouettes, readable thumbnail composition, and a cohesive high-contrast palette. Prefer a license-compatible official asset only when it already fits that language; otherwise generate an original pixel-art reinterpretation that communicates the benchmark domain without presenting itself as source evidence. Do not pass a mismatched image through a coarse pixelation filter and call it finished. Keep it free of unlicensed logos, provider marks, invented scores, fake UI, or data-looking claims. Record whether it is official or original, its source or generation date, license/provenance, and its non-evidentiary role in `assets/README.md`. Follow the repository cover contract for allowed formats, safe relative paths, file signatures, and size limits. Preserve an existing cover on ordinary updates unless the request calls for replacement.

Consider useful charts, screenshots, diagrams, or other figures separately while inspecting the official repository, project page, publication, and result artifact. During research, optionally use a browser tool to capture a credential-free first-party public page when its visible UI or visualization would materially help readers and no suitable static asset exists; this is a judgment call, not a required step or completeness gate. For any figure used, record its URL or path, version or capture date, provenance or license, metric and filter boundary, data coverage, and whether it is static or dynamically rendered. Prefer a committed official asset whose scope matches the submitted results. Label a browser capture as a dated official-page screenshot and record its visible tab, filter, or state; do not treat live values as fixed result evidence unless their boundary matches the pinned submission. Recreate a chart only from pinned source data and label it as derived. Record a brief handoff reason only when a materially useful figure was considered but omitted.

Identify Harness from first-party runner, task, agent, solver, client, or result metadata. Harness means the agent scaffolding or product wrapped around the base model; it is not the benchmark environment, scorer, deterministic packer, or EvalHub validation workflow. Record its published name, track or configuration boundary, and version when the source provides one. Do not infer a version from a later dependency lockfile or repository tag when the published result rows came from other revisions.

## Stage 2: author the Markdown-only detail page

New detail pages and substantial rewrites must use one contract only:

```yaml
detail_profile:
  source_kind: upstream_publication
  markdown: |-
    ## 榜单
    ...
```

Do not rebuild the page from legacy structured detail fields. Keep machine-readable fields only when repository schema or result ingestion still requires them; the reader-facing body is `detail_profile.markdown`.

The platform renders the Hero. Begin authored content at H2 and normally use this order:

1. `## 榜单`
2. `## 官方分项结果`
3. `## 关于此评测`
4. Optional source-backed observations, method details, figures, or resources
5. `## 题目案例`
6. `## 一手资料`

Equivalent benchmark-specific headings are allowed. Do not repeat the Hero, add empty filler sections, or jump heading levels.

### 榜单

Use one compact cross-model table. It contains rank, model, the official total or primary ranking metric, and Harness for agent evaluations. Do not omit Harness merely because every participant shares it. For non-agent interfaces, include it only when the source genuinely defines a comparable harness. Do not add a “口径” column. Keep model names as plain text without Markdown links or anchors.

Render public score columns, including component scores, with no more than one decimal place. Integers may remain integers; counts, costs, times, and other non-score measurements retain the precision needed to stay meaningful. Compute ranks, ties, and aggregates from the unrounded source values, and preserve source precision in machine-readable result files; display rounding must not change the ranking. State the rounding convention once when it is not obvious.

Use the source-published Harness name when one exists. When every participant uses the same task-provided default and the source does not name variants, label it `题目默认 harness`. Render Harness as secondary metadata rather than a competing headline value, and explain a shared fixed configuration once instead of repeating an implementation audit.

Preserve every official participant. Tables with more than eight body rows are expected: the platform initially shows eight rows and provides expansion for all remaining rows, so do not delete lower-ranked models for brevity.

### 官方分项结果

Convert source results into one or more complete cross-model Markdown tables:

- one row per model whenever models are the shared comparison axis;
- retain all source-backed metrics needed to understand the official result;
- combine score, resource, execution, cost, time, token, or judging fields when one readable table works well;
- split them into multiple cross-model tables when different units or reader questions make that clearer;
- never emit one table or tab per model;
- use `—` only for a genuinely source-missing cell and explain missing coverage nearby;
- allow related official figures or result illustrations in this section, placed beside or immediately after the table they explain;
- keep each figure source-backed, and state when an illustration is derived from cited result values rather than published directly by the upstream source;
- never use an image as a replacement for the comparable Markdown data.

There is no universal five-, seven-, three-, eleven-, or thirteen-column layout. Choose the smallest number of readable tables that preserves the source data and supports cross-model comparison.

Do not move a result illustration into a separate observations section merely because it is an image. Keep it under `## 官方分项结果` when it directly visualizes those results. Reserve a later observations section for figures that do not directly explain a result table.

### 关于此评测

Explain in plain language:

- what the benchmark measures;
- what a task asks the model to do;
- how the official score is computed or judged;
- important limitations needed to interpret the numbers.

Do not turn this section into an implementation or reproducibility audit.

### 题目案例

Show at most five representative tasks. Select them deterministically across authored task order, including the first and last when at least two are shown. For `n` tasks and `k = min(5, n)`, select index `0` when `k = 1`; otherwise use indices `round(i * (n - 1) / (k - 1))` for `i = 0..k-1`.

Select from the complete in-scope task set, not from a manually reduced convenience subset. When at least two in-scope source-backed tasks exist, show at least two. Show only one when the submitted evaluation boundary genuinely contains one task, and say so near the case section. Do not add out-of-scope tasks merely to increase the count.

Only displayed cases require `translation`; other tasks may omit it. Every displayed case must contain:

1. the complete original `prompt`;
2. a complete, faithful Chinese translation.

The translation must preserve all instructions, constraints, warnings, paragraphs, lists, code blocks, commands, paths, filenames, literals, placeholders, formulas, numbers, units, and examples. A synopsis, omission marker, or link-only substitute is not a full translation. Long content stays complete in data; the platform may fold it visually.

### 一手资料

End with credential-free HTTPS links to the primary sources actually used. Prefer the official repository, paper, project page, task source, and result source. Do not add secondary discovery pages when a primary source is available.

## Stage 3: preserve repository data

- Every task has a non-empty unique ID matching `^[a-z0-9][a-z0-9-]{0,63}$`.
- `prompt` remains the complete task statement; do not replace it with a summary for display convenience.
- Published results preserve every official participant and source-backed value.
- `score` remains the primary ranking metric expected by the repository schema.
- Use registered canonical model IDs in machine-readable results and the registry-resolved display names in reader tables. Verify that every published participant resolves through the repository model registry; do not expose an upstream label as a canonical ID when a registry mapping exists.
- For agent results, preserve the source-backed agent scaffolding in `participant.harness`. Preserve `harness_version` only when the result source publishes it; an `upstream_author_publication` may omit an unavailable version, while ordinary result envelopes must follow the repository's paired Harness fields. Never substitute the benchmark runner, scorer, or packer as Harness.
- Preserve source precision in machine-readable values even when the Markdown display is rounded to one decimal place.
- Supplementary views may remain for machine-readable compatibility, with stable IDs and consistent shared metadata, but the Markdown page must contain the reader-facing cross-model table itself.
- `sample-result.json` illustrates schema shape only and must not be presented as a published result.
- Existing files outside the requested eval remain untouched.

## Stage 4: verify readiness and preview

Keep the final check short:

1. Confirm Markdown-only structure, coherent H2/H3 order, no repeated Hero, and a declared local cover for every new eval.
2. Confirm all official models and rows remain, result tables compare models directly, and there are no per-model table fragments.
3. Confirm at most five displayed cases, each with the complete original and complete Chinese translation.
4. Confirm sources work and no placeholders or invented values remain.
5. Confirm public score displays use at most one decimal while machine-readable values retain source precision, registry IDs resolve, and agent Harness identity is visible and source-backed.
6. Use the repository's required checks and official preview workflow as the execution source of truth. Do not duplicate their commands in this skill or invent an alternate validation path.
7. For a pull request, report the exact candidate commit and wait for its required cloud checks and official preview. Do not install dependencies or run validation on the user's workstation unless the user explicitly requests local execution.

Treat content, schema, policy, and rendering checks according to what their workflow actually runs. Never describe a static repository check or successful preview as benchmark runtime verification. Internal readiness labels such as CI state, audit state, or `runtime verification: unverified` belong in structured status or the handoff unless the platform explicitly exposes them and they materially help readers interpret the results; do not add them as reader-facing limitation prose by default.

When updating an existing reader, also compare the base and candidate for accidentally missing sections, models, rows, figures, or selected task cases. The check is a regression alarm, not a requirement to preserve old table widths or exact table families.

## Handoff

Report:

- files changed;
- primary sources used;
- cover path, provenance, and whether it is official or an original non-evidentiary illustration;
- Harness name, version availability, configuration boundary, and source;
- official participant and table coverage;
- displayed task-case IDs and translation coverage;
- omitted visual candidates and reasons, when applicable;
- exact candidate commit, required cloud-check results, and official preview URL;
- the precise scope of validation, without implying benchmark execution that did not occur;
- any unresolved source gap.

Do not describe a PR, merge, deployment, or external action as complete unless it actually occurred.
