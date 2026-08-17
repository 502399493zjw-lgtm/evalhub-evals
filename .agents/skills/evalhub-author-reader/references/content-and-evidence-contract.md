# EvalHub content contract

This reference defines the small set of content rules shared by EvalHub Markdown detail pages. It does not define frontend styling, runner implementation, reproduction steps, or a task-level evidence system.

## One reader contract

Use `detail_profile.markdown` as the reader-facing source of truth for every new page and substantial rewrite. Legacy structured fields may remain only where repository schema or migration compatibility requires them; they do not define a second page layout.

The Hero comes from top-level metadata. Markdown starts at H2 and must not repeat the title, author, tags, or summary already shown in the Hero.

## Recommended reader flow

1. Compact leaderboard
2. Official component results
3. Benchmark explanation and method
4. Optional source-backed observations or figures
5. At most five task cases
6. Primary sources

Benchmark-specific headings are fine when their roles are clear.

## Result tables

- The leaderboard is a compact cross-model summary: rank, model, primary metric, and Harness when useful. Do not add a “口径” column.
- All official participants remain in the Markdown data.
- More than eight rows is normal; the platform initially shows eight and expands the remainder.
- Official component data appears in one or more cross-model tables, never one table or tab per model.
- Authors may combine score, resource, execution, time, token, cost, and judging fields into one table when readable, or split them by purpose when clearer.
- There are no fixed column counts or mandatory table families.
- Official figures may coexist with comparable tables but may not replace them.
- Model names are plain text.
- Use `题目默认 harness` when all models use the same unnamed task-provided default.

## Task cases

Show no more than five representative tasks. Only those displayed cases require a Chinese translation. For every displayed case, preserve the full original prompt and translate it in full; do not use a summary, omitted middle, or link-only substitute. Preserve code, paths, filenames, literals, placeholders, formulas, numbers, units, and examples.

## Repository data

- Tasks have stable unique IDs.
- Published results preserve all source-backed participant rows and values.
- The primary score and any machine-readable supplementary views continue to follow repository schema.
- The Markdown body contains the actual comparable result tables and does not depend on frontend derivation.
- Sample results illustrate schema only.

## Sources

Use primary sources for factual claims, result values, task text, and figures. End the Markdown with credential-free HTTPS links to the sources used. Omit unsupported optional claims instead of filling them with guesses or placeholders.

## Acceptance checklist

- Markdown-only reader structure is present and headings are coherent.
- The leaderboard is compact and all official participants remain.
- Component results use readable cross-model table(s), with no per-model fragments.
- Tables keep all source-backed rows; long tables expand beyond eight rows.
- At most five task cases are shown and each has full original text plus full Chinese translation.
- Primary links work and no placeholder or invented value remains.
- Repository validation, structure preflight, diff check, and local preview pass.
