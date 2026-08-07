---
name: evalhub-author-reader
description: Research, author, revise, and validate one source-backed EvalHub evaluation submission. Use when creating or updating an eval directory, detail_profile, published-results, sample results, task fixtures, runner documentation, or the evidence shown on an EvalHub detail page.
---

# EvalHub Author Reader

Build one reviewable evaluation package whose detail page has useful, consistent information without inventing evidence. Treat page layout and visual styling as platform concerns; this skill owns research, content structure, result provenance, repository files, and validation.

## Read before editing

Read these files completely:

1. `../../../CONTRIBUTING.md`
2. `../../../llms.txt`
3. `references/content-and-evidence-contract.md`
4. The target `evals/<slug>/eval.yaml`, `README.md`, task fixtures, runner, sample result, and published results when updating an existing eval

Also inspect repository-local instructions and CI configuration. If any instruction conflicts, follow the more specific repository instruction and report the conflict.

After classifying the source shape, read the matching section of `references/golden-reader-patterns.md`: use the CEO-style pattern for long-horizon operating results, the RSI-style pattern for multi-benchmark result tables, and the task-case pattern for every upstream task.

## Scope the submission

Confirm only what cannot be learned safely:

- whether this is a new eval or an update;
- the source repository or exact source directory;
- the target slug for an update, if the link does not identify it.

Work inside exactly one `evals/<slug>/` unless the task explicitly changes a shared repository contract. Do not rename an existing slug. Preserve the owner in `AUTHORS` for updates. A new eval needs one matching exact CODEOWNERS rule.

Do not merge, deploy, or broaden the PR beyond the requested eval. Never place credentials, model calls, hidden files, archives, symlinks, or executable binaries in the eval directory.

## Stage 1: inventory the evidence

Read the source before designing fields. For a repository, inspect README files, code, task/data files, examples, tests, releases or commit tags, license, and citations. For an upstream benchmark, additionally locate its paper, official project page, official author repository, appendices, and official result artifacts.

Create a working source ledger before authoring:

| Claim or artifact | Primary URL or repository path | Source kind | Version/date | Target field | License/provenance note |
| --- | --- | --- | --- | --- | --- |

Fill every ledger cell with reviewed values before mapping it into repository files. Do not use `TODO`, `待补`, literal `placeholder`, `example.com`, or a repeated/example digest as a temporary machine-readable source value; omit an unsupported optional claim instead.

Use first-party sources. Search results, mirrors, news posts, and secondary summaries may help discovery but cannot be the final support when a paper, official site, author repository, task definition, runner, or test exists.

Classify the eval once:

- `evalhub_native`: the checked-in definition, tasks, runner, and scoring code are the primary protocol.
- `upstream_publication`: the protocol or results come from an external paper, official site, or official author repository.

For every `runner: builtin` eval, inspect the authoritative implementation in the EvalHub main repository: the selected scorer under `packages/cli/src/scorers/` and the orchestration and aggregation in `packages/cli/src/commands/run.ts`. Verify normalization, the match predicate, per-task points, aggregation, rounding, and any version boundary; never infer semantics from a scorer name such as `exact`. If the standalone repository does not contain those files, obtain a credential-free HTTPS permalink pinned to an authoritative commit or release and record it in the source ledger. Stop before publishing protocol claims if no such implementation source is available.

Record version and license boundaries. Name the protocol revision, commit, release, or publication date that fixes the comparison boundary. In the eval README, state which repository or upstream license governs each checked-in task, fixture, result artifact, and redistributed asset. If no license grant can be found, record only the observable boundary: no independent open license was found, and permission must not be inferred from the files being visible. Do not present this provenance note as a legal conclusion; stop before publishing third-party material until the applicable authorization is confirmed. Do not imply upstream endorsement, official affiliation, or an EvalHub rerun that did not happen.

## Stage 2: map evidence to the repository contract

Separate three layers:

1. `eval.yaml` and `detail_profile` explain the protocol.
2. `published-results/*.json` contains reviewed source results and their supplementary views.
3. Real run envelopes contain `task_results` and `showcases` as execution evidence.

Author the protocol first: every `tasks[]` entry must declare a non-empty ID matching `^[a-z0-9][a-z0-9-]{0,63}$`; task IDs must be unique within the eval and remain unchanged while the task identity is unchanged. Keep the two prompt roles separate: `prompt` is the exact executable EvalHub protocol consumed by the runner/scorer, while optional `display_prompt` is the complete source-published original shown to readers. For an `upstream_publication`, always provide `display_prompt`; never put a summary, excerpt, `[…]`, or link-only placeholder there. Add a concise `label` for the task tab and a complete `translation` when a faithful Chinese rendering is available. Long display text is a platform folding concern and must not be shortened in data. Interface, runner, scoring, scorer, score policy, baseline policy, score unit, trials, command template, and scoring note must agree with the README and runner behavior.

Treat `protocol_revision` as the monotonic version of the scoring protocol. Keep it unchanged for corrections to `display_prompt`, `translation`, `label`, prose, `detail_profile`, README text, citations, or official baselines that do not change result comparability. Increment it when task identity or executable `prompt`, interaction or run procedure, scorer predicate or normalization, score aggregation or rounding, trials, primary metric or unit, or tie-break semantics change, and document the reason. Never replace `prompt` with upstream display copy merely to improve the reader page.

Then fill every required `detail_profile` field from the ledger. Write for a reader who has not read the paper or code:

- say plainly what the model does and why the capability matters;
- describe the actual input, run, judging, and aggregation in 2–6 steps;
- explain score direction, unit, aggregation, and comparison boundary;
- include concrete facts only when directly supported;
- disclose at least one material limitation;
- link at least one credential-free HTTPS primary source.

Use optional `overview_note` and `resources_note` only for short source-backed section introductions. When a paper or official repository publishes a compact protocol, environment, or action-space table, transcribe it into `overview_tables` with stable table/column/row IDs, complete `column_id`-addressed rows, and the exact primary-source URL. Omit the table when any displayed cell is unsupported. Never put model scores, result trends, inferred values, or execution traces in `overview_tables`; those belong to reviewed result envelopes or real run evidence.

Author content for the platform's fixed detail-page order and names: hero/source; `榜单`; `官方分项结果`; `关于这套评测`; `题目案例`; `资料与分析`; footer. These five reader modules remain present with an explicit empty state when data is absent. Supply data for these regions, not layout code.

Replace every generated `TODO`, `待补`, literal `placeholder`, and every `example.com` URL. Omit optional facts or figures when evidence is weak. Never add arbitrary HTML, MDX, React, or layout instructions to emulate the detail page.

## Stage 3: preserve result provenance

Choose the result path by evidence origin:

- An upstream paper/site/GitHub aggregate uses `submission.kind: upstream_author_publication`, a numeric primary `score`, source metadata, and optional `supplementary_views`. It must not include `usage`, `task_results`, or `showcases`.
- A real EvalHub run may include `task_results` and `showcases`. Those fields must come from actual runner output, not a paper table, prose summary, or design mock.
- `sample-result.json` is a schema and runner fixture. Never describe its demo participant, score, output, or trajectory as an official benchmark result or verified rerun.

Use the complete upstream-envelope, `metric_table`, and `line_chart` examples in `references/content-and-evidence-contract.md` as the canonical authoring shapes. Parsers may tolerate historical supplementary views without `id` or `label`, but every new or updated view in `sample-result.json` or `published-results/*.json` must provide both as non-empty strings; IDs must be stable slug-style values and unique within one result. The standalone repository validator enforces this stricter authoring boundary without changing runtime compatibility.

Treat one supplementary-view `id` as one logical reader tab across all published participants. For that ID, keep `type`, `title`, `label`, and table `columns` or chart axis labels exactly identical in every result; only rows, series, points, and notes may vary. This lets the platform safely derive CEO-style participant summaries and RSI-style per-benchmark comparison tabs. Do not suffix the ID with a participant name.

Put one ranking number in `score`. Preserve source-published subgroups, components, scenarios, or trends in `supplementary_views` only when the source actually provides the points. There is no separate `derived` or `formula` field: put a derived primary score's status, formula, and source inputs in the result `detail`; put the same information for a derived supplementary value in that view's `note`. Prefix the explanation with `Derived:` and do not call the value official.

Every `task_results[].task_id` and optional `compare` or `transcript` showcase `task_id` must reference a stable task ID in `eval.yaml`. A real run may emit one task result per configured trial, so the same task ID may appear at most the `trials` value declared in `eval.yaml` times within one result; the next occurrence is invalid.

For every authored run envelope, set `submission.run_date` to a real calendar date in exact `YYYY-MM-DD` form; values such as `2026-02-29` and `2026-04-31` are invalid. For an upstream publication, transcribe the ledger into `submission.importer_version` and `submission.source`: use a real primary-source URL, an optional reviewed title, and the lowercase SHA-256 of the exact artifact inspected. The authoring validator rejects placeholder markers, `example.com`, and obviously repeated example digests while the shared runtime schema remains backward compatible.

Never fabricate, interpolate, smooth, or backfill model scores, trend points, income curves, timestamps, outputs, screenshots, or trajectories. If the source does not contain them and no real run produced them, omit the block.

## Stage 4: implement reproducibly

For a new eval, scaffold with `evalhub init <slug>`, then replace every placeholder. Keep fixtures small, bounded, and reviewable.

For custom runners:

- use literal argv with exactly one standalone `{output}` token;
- perform no model or network calls;
- validate bounded inputs and write an atomic result envelope;
- run without network, as non-root, with a read-only filesystem and explicit resource limits;
- document invocation, input format, failure behavior, isolation, and score production.

Set `score_policy: required` when submissions must already contain a numeric score. Use `author_fill` only for genuinely author-scored artifacts. Set `baseline_policy: required` only when a reviewed numeric baseline is included under `published-results/`.

## Stage 5: validate and review

Run the repository gates from the evals repository root:

```bash
npm ci
npm test
npm run validate
```

These automated gates validate structure and repository authoring invariants only. They do not fetch or verify source URLs, determine whether a license grants the needed rights, fact-check prose or numbers, or compare README and `detail_profile` claims with runner semantics. Complete those source-ledger, license-boundary, factual, and runner-code reviews manually even when every command passes.

Run the eval or custom runner when practical and verify its generated envelope with the same schema. Check that:

- `detail_profile` and machine-readable source metadata are complete, source-backed, and free of `TODO`, `待补`, literal `placeholder`, `example.com`, and example digests;
- every authored `submission.run_date` is a real `YYYY-MM-DD` calendar date;
- displayed claims are traceable to the source ledger;
- every overview table is a complete transcription with unique stable table, column, and row IDs and a primary-source HTTPS URL;
- official aggregate data is not presented as an EvalHub rerun;
- sample data is not presented as evidence;
- shared supplementary-view IDs keep one exact metadata contract across all published participants;
- every task declares a unique stable slug-style ID, task references resolve, and each task ID appears no more than the configured `trials` count;
- optional sections disappear cleanly when unsupported;
- the diff stays within one eval directory plus its exact CODEOWNERS rule.

Complete this reader-readiness matrix from the final files before handoff. “Empty” is acceptable only when the source ledger or run evidence genuinely has no supported content; never fill a module to make the matrix look complete.

| Reader module | Required data check |
| --- | --- |
| `榜单` | Primary `score`, unit/direction, participant identity, and result provenance agree. |
| `官方分项结果` | Every supported source table/chart is preserved; shared view contracts are identical across participants. |
| `关于这套评测` | All required `detail_profile` fields and at least one primary source are complete. |
| `题目案例` | Stable task ID; executable `prompt`; full upstream `display_prompt`; translation and real model evidence when available. |
| `资料与分析` | Source-backed resources and figures only; unsupported optional blocks are omitted. |

Do not reduce the stored official leaderboard to three or four participants merely to imitate a compact task-case control. The platform may show up to four real model results inside a task case; only real `task_results` or task-linked showcases qualify, and an upstream aggregate never does.

If a local platform preview is available, inspect the generic `/e/<slug>` rendering for content order and missing-data fallbacks. Do not change platform styling as part of an eval submission; use the repository's visual-design workflow separately when visual implementation is explicitly requested.

Before handoff, summarize the source kind, primary sources, protocol and score semantics, result provenance, omitted unsupported content, changed files, and validation results. Stop and ask only when source access, licensing, ownership, or a protocol-defining ambiguity remains unresolved.
