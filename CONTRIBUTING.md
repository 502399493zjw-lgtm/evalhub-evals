# Contributing

Keep evals reproducible, cheap to review, and explicit about both the interaction interface and who scores the result. Platform/server code never performs model calls; a CLI adapter or a documented custom runner produces a result envelope.

## Author an eval through a PR

Fork this repository with the GitHub account that will own the eval, create a branch from the latest upstream `main`, and scaffold the directory:

```bash
git checkout -b add-my-eval
evalhub init my-eval
```

From this monorepo, the equivalent command is:

```bash
../packages/cli/node_modules/.bin/tsx ../packages/cli/src/index.ts init my-eval
```

Complete `eval.yaml`, `README.md`, `AUTHORS`, `sample-result.json`, `tasks/README.md`, and `assets/README.md`. Put useful deterministic fixtures in `tasks/`; put only reviewable static display resources in `assets/`. Every new custom eval must explicitly set top-level `custom_mode: executable` or `custom_mode: external_workflow` and use a literal-argv `command_template`. An executable custom runner uses exactly one standalone `{output}` token and a safe slug-specific output filename. An external-workflow custom runner instead uses exactly one standalone `{input}` token. A formal command must never hard-code `tasks/example-*`; those paths are synthetic fixtures, not participant submissions. Keep a deterministic external-workflow fixture at `tasks/example-submission.json`. That fixture is documentation and sample data, not something EvalHub CI, preview services, or platform servers execute. Real `evalhub pack` calls still require the participant's explicit `--input` file. The shared schema continues to resolve an omitted mode on historical definitions for compatibility, but the new-eval PR gate requires the explicit declaration.

Declare a positive integer `protocol_revision` (start at `1`). Increase it when tasks, execution, the primary score, tiebreaks, or participant identity semantics change comparability. Do not increase it for copy, README, references, or official baseline-data maintenance. The platform binds accepted scores to the commit that first introduced the current revision while tracking the latest source commit separately, so maintenance-only changes do not clear a leaderboard and a real protocol change cannot inherit stale scores.

Declare `score_policy: required` when every submission must already contain a numeric score. Use `score_policy: author_fill` only when the author genuinely needs to score submitted artifacts later (and only with `scored_by: author`). If an official or trusted baseline is available, declare `baseline_policy: required` and add reviewed `upstream_author_publication` envelopes under `published-results/*.json`; the platform binds them to the current protocol commit and imports them without a user-visible secret. Preserve useful subgroup/component/trend metrics in `supplementary_views` (`metric_table` or `line_chart`) while keeping one documented main `score` for ranking. In upstream publications, keep the base model in `participant.model` and Codex, Claude Code, or another product/agent in `participant.harness`; omit `harness_version` when the source does not publish one, and never invent or concatenate identity fields.

For a new or substantially revised reader page, prefer a source-backed `detail_profile` using `source_kind + markdown`. The platform owns the standard Hero; start the Markdown body at `##` and keep the protocol, score semantics, results, task cases, limitations, resources, and primary-source links in that one document. When an official breakdown contains two or more comparable models, use exactly one `## 官方分项结果`: put shared method, formula, provenance, and caveats before the first H3, then one non-empty `### <short model label>` block per model. Each H3 becomes a clickable model tab, so use H4 or ordinary Markdown inside a model block. Preserve missing data and comparability boundaries; never invent models or values to fill the control. In `## 题目案例`, every `### <short case label>` is an outer task tab and must contain complete fenced `#### 题目原文` and `#### 中文翻译` blocks. Optional final `#### 公开结果` may contain shared provenance followed by one non-empty `##### <short model label>` block per comparable model; every H5 becomes a nested result tab. A fixed-profile aggregate must be explicitly identified as an aggregate rather than a single-task output, and no output, trace, model, or value may be fabricated. The renderer derives interactions from this heading grammar but does not inject result content outside the Markdown.

`AUTHORS` supports exactly one GitHub handle and records the eval maintainer. The public author is resolved from the source GitHub repository owner: `upstream.repo` first, then an exact `references.repository` homepage, then the owner of this repository for a native eval. A source organization is shown as the public author, but organization membership does not grant update access.

For a new eval, `AUTHORS` must match the GitHub user opening the PR. For an existing eval, the PR creator must match either the public source owner resolved from the base `eval.yaml` or the base `AUTHORS` maintainer. The base `AUTHORS` file must remain byte-for-byte unchanged, and changing source metadata in the head cannot self-authorize a third party. The slug is a permanent identifier; change `eval.yaml.name` when only the display name needs to change.

One PR may create or update exactly one `evals/<slug>/` directory and may not mix in repository-level changes. A third party cannot update someone else's eval, even with an approval or a claim in the PR body. Do not edit `.github/CODEOWNERS`: repository review remains with `@502399493zjw-lgtm`, while update access is enforced independently from `AUTHORS` and the trusted PR actor.

An eval PR opened for an EvalHub submission task must carry the submission marker EvalHub issued with that task, copied into the PR description verbatim:

```
<!-- evalhub-submission task=evaltask_<uuid> kind=new|update slug=<slug> -->
```

That marker is how the platform binds this PR to your submission and publishes it after merge; without it the submission can never leave `agent_working`, so `pr-policy` fails the PR. Exactly one marker is allowed and its `slug` must be the eval this PR changes. Use `kind=new` for a new eval and `kind=update` for an existing eval update. Repository-maintenance and unsupported deletion/ownership-management PRs must not carry a marker.

Run the required standalone content gate before opening a PR:

```bash
npm ci --ignore-scripts
npm run validate
```

The content gate allows only bounded, reviewable text/code/data and static SVG files. It rejects hidden files, symlinks, submodules, binary executables, archives, Git LFS pointers, invalid structured data, active SVG content, recognizable credentials, path escape in checked-in repository references, and invalid UTF-8. A single eval is limited to 150 files and 25 MiB total; text/code/data files are limited to 2 MiB each and SVG files to 8 MiB each. It also checks eval and result schemas, task and supplementary-view references, score and baseline policies, participant identity, source metadata, and basic custom-runner metadata and path integrity. Absolute tool or resource paths and external resource URIs are user-environment requirements, not repository references; document them accurately instead of treating their presence as a runtime safety finding. A text runner may carry an executable mode bit; that mode is not a runtime or safety endorsement.

An ordinary eval contribution runs only the two commands above; it does not run a maintenance suite or a runner-validation command. Use `npm run test:maintenance` only when maintaining validators, schemas, vendored contracts, CI, or another repository-level contract. Neither local submission validation nor PR or `main` CI requires Docker or executes third-party runner code.

GitHub runs PR-policy and lightweight content-validation checks. Community PRs require maintainer approval. The maintainer's own official or repository-maintenance PR still runs the applicable PR chain and is merged only through the explicitly allowed administrator bypass; direct pushes to `main` are not part of the workflow.

## Post-merge integrity and import contract

The `main` integrity boundary is limited to content-schema validation, repository-file safety, and downstream import compatibility. A schema or other global contract change may validate all checked-in content, but no `main` workflow may execute a submitted runner, and an ordinary eval-content change must not trigger the infrastructure maintenance test suite.

This repository does not contain the downstream importer, so the following is a publication contract rather than a claim about an implementation here: an importer **MUST** fully validate a candidate repository snapshot before making it visible and **MUST** switch versions transactionally. If candidate validation or import fails, it **MUST** retain the previously published version instead of exposing a partial or invalid snapshot.

## Run and submit a built-in eval

Use `--local ./evals` against this checkout. A command-adapter smoke run has no external model call:

```bash
export EVALHUB_COMMAND='node -e "process.stdin.resume(); process.stdin.on(\"data\",()=>{}); process.stdin.on(\"end\",()=>console.log(\"不知道\"))"'
evalhub run chinese-nuance --local ./evals --adapter command --model local-wrapper-20260710 --out chinese-nuance-result.json
```

For an OpenAI-compatible endpoint, keep both the participant and pinned judge credentials outside result files:

```bash
export EVALHUB_MODEL_BASE_URL="https://api.example.com/v1"
export EVALHUB_MODEL_API_KEY="<participant-key>"
export EVALHUB_JUDGE_API_KEY="<judge-key>"
evalhub run cold-jokes --local ./evals --adapter api --model kimi-k3 --out cold-jokes-result.json
```

Participant model IDs use the concrete name available at the calling API or harness (for example `kimi-k3`); a date suffix is not required. Chat and agent envelopes contain exactly one result; dialogue envelopes contain at least two unique participants. Harness and harness version are an optional pair on agent participants only.

Submit the slug-specific output:

```bash
evalhub submit cold-jokes-result.json --platform-url "https://evalhub.example.com"
```

## Run a custom eval

EvalHub-hosted services and repository automation do not execute third-party runners, and EvalHub does not audit or guarantee them. Runners are downloaded and executed only in users' own environments, either directly or through a local tool after explicit confirmation. Users should review the source and code before running one and decide whether to use a container, virtual machine, or other isolation measures. Repository checks cover metadata syntax, referenced paths, schemas, and repository-file safety only; passing them does not establish that a runner is safe, compatible, or runnable.

Before choosing to run one, check that its documentation records:

1. its upstream repository or source URL;
2. a pinned commit, tag, or release;
3. installation and invocation instructions;
4. input and output conventions;
5. required network access, tools, compute, and permissions;
6. known limitations.

After that review, use the exact runner documented by the eval rather than the built-in CLI scoring path. The current repository includes this optional manual example:

```bash
node evals/rsibench-data/pack-to-result.mjs evals/rsibench-data/tasks/example-submission.json --out rsibench-data-result.json
```

The runner's own documentation, not EvalHub, describes its failure behavior and any runtime checks it performs. EvalHub checks the resulting envelope's format and its references but does not establish that the runner works in a particular environment. Do not describe an unexecuted runner as tested, runnable, safe, or security-reviewed. If a user runs it, report only the exact environment and observed result; that observation is not an EvalHub guarantee.

Any EvalHub CLI feature that can launch a third-party runner must display the runner's source and this risk boundary before the first run, require explicit user confirmation, and must not silently execute it or display a claim such as "security verified."

## Choose interface and scorer independently

All six `interface × scored_by` combinations are valid. Choose the interface from the interaction shape and `scored_by` from who can responsibly finalize the score:

| interface | `scored_by=local` | `scored_by=author` |
| --- | --- | --- |
| `chat` | One participant; exact, judge, or custom scoring may be appropriate. | One participant; exact, judge, or custom evidence can remain null until author review. |
| `dialogue` | At least two unique participants; local games, simulations, judge, or custom scoring are allowed. | At least two unique participants; the author can review transcripts or judge evidence. |
| `agent` | One agent; exact tests, pinned judge, or custom deterministic checks are allowed. | One agent; builds and artifacts commonly wait for author review, but judge+author is also valid. |

Rules are orthogonal:

- `scoring=judge` requires a pinned `judge_model`; it may use either `scored_by=local` or `scored_by=author`.
- `scored_by=author` requires a public `scoring_note` and controls who recognizes a score; it does not by itself decide whether `score: null` is legal.
- `score_policy=required` rejects `score: null`. `score_policy=author_fill` allows it and requires `scored_by=author`. For compatibility, an omitted policy resolves to `author_fill` on existing author-scored evals and `required` otherwise; new evals should state it explicitly.
- `baseline_policy=required` makes a valid numeric `published-results/*.json` baseline part of publication readiness. `null` never satisfies that gate.
- `runner=custom` requires `command_template`; `runner=builtin` must omit it.
- A local-scored result has a numeric score before submission.
