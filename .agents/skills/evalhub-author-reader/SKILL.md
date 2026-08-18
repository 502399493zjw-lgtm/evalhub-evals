---
name: evalhub-author-reader
description: Research, author, revise, and validate one source-backed EvalHub evaluation submission with a Markdown-only detail page, complete official result tables, and fully translated selected task cases.
---

# EvalHub Author Reader

Build one reviewable EvalHub evaluation package. This skill owns source research, repository content, Markdown structure, result transcription, selected task cases, and validation. The platform owns page styling and interaction.

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

Every published statement, result value, table, and figure must be traceable to this ledger. Omit unsupported optional content instead of guessing. Do not leave `TODO`, `待补`, literal `placeholder`, `example.com`, fabricated values, or credential-bearing URLs.

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

Use one compact cross-model table. It normally contains rank, model, the official total or primary ranking metric, and Harness when it helps comparison. Do not add a “口径” column. Keep model names as plain text without Markdown links or anchors.

When every participant uses the same task-provided default and the source does not name variants, label it `题目默认 harness`. Render Harness as secondary metadata rather than a competing headline value.

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

Show at most five representative tasks. Select them deterministically across authored task order, including the first and last when at least two are shown. For `n` tasks and `k = min(5, n)`, use indices `round(i * (n - 1) / (k - 1))` for `i = 0..k-1`.

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
- Supplementary views may remain for machine-readable compatibility, with stable IDs and consistent shared metadata, but the Markdown page must contain the reader-facing cross-model table itself.
- `sample-result.json` illustrates schema shape only and must not be presented as a published result.
- Existing files outside the requested eval remain untouched.

## Stage 4: validate and preview

Keep the final check short:

1. Confirm Markdown-only structure, coherent H2/H3 order, and no repeated Hero.
2. Confirm all official models and rows remain, result tables compare models directly, and there are no per-model table fragments.
3. Confirm at most five displayed cases, each with the complete original and complete Chinese translation.
4. Confirm sources work and no placeholders or invented values remain.
5. Run repository validation, the structure preflight, and inspect a local preview including long-table expansion.

Use:

```bash
npm ci --ignore-scripts
npm run validate
node .agents/skills/evalhub-author-reader/scripts/report-reader-structure.mjs \
  --reference evals/rsibench-data/eval.yaml \
  evals/<slug>/eval.yaml
git diff --check
```

When updating an existing reader, also compare the base and candidate for accidentally missing sections, models, rows, figures, or selected task cases. The check is a regression alarm, not a requirement to preserve old table widths or exact table families.

## Handoff

Report:

- files changed;
- primary sources used;
- official participant and table coverage;
- displayed task-case IDs and translation coverage;
- validation and preview result;
- any unresolved source gap.

Do not describe a PR, merge, deployment, or external action as complete unless it actually occurred.
