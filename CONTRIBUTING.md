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

Complete `eval.yaml`, `README.md`, `AUTHORS`, `sample-result.json`, `tasks/README.md`, and `assets/README.md`. Put useful deterministic fixtures in `tasks/`; put only reviewable static display resources in `assets/`. A custom runner must have a literal-argv `command_template` with exactly one standalone `{output}` token and a safe slug-specific output filename.

Declare `score_policy: required` when every submission must already contain a numeric score. Use `score_policy: author_fill` only when the author genuinely needs to score submitted artifacts later (and only with `scored_by: author`). If an official or trusted baseline is available, declare `baseline_policy: required` and add reviewed `upstream_author_publication` envelopes under `published-results/*.json`; the platform binds them to the merged eval commit and imports them without a user-visible secret. Preserve useful subgroup/component/trend metrics in `supplementary_views` (`metric_table` or `line_chart`) while keeping one documented main `score` for ranking.

`AUTHORS` supports exactly one GitHub handle. For a new eval, it must be the GitHub user that opens the PR. For an existing eval, the PR creator must match the handle already present on the base branch and the PR must not change `AUTHORS`. The slug is a permanent identifier; change `eval.yaml.name` when only the display name needs to change.

One PR may add or update exactly one `evals/<slug>/` directory and may not mix in repository-level changes. A third party cannot update someone else's eval, even with an approval or a claim in the PR body. Do not edit `.github/CODEOWNERS`: repository review remains with `@502399493zjw-lgtm`, while eval ownership is enforced independently from `AUTHORS` and the trusted PR actor.

Run the standalone gates before opening a PR:

```bash
npm ci
npm test
npm run validate
npm run validate:runner
```

The content gate allows only bounded, reviewable text/code/data and static SVG files. It rejects hidden files, symlinks, submodules, executable modes, archives, Git LFS pointers, invalid structured data, active SVG content, recognizable credentials, and unsafe custom-runner capabilities. A single eval is limited to 150 files and 25 MiB total; text/code/data files are limited to 2 MiB each and SVG files to 8 MiB each.

`npm run validate:runner` requires Docker. Every custom runner executes without network access, as a non-root user, with a read-only filesystem, no Linux capabilities, bounded CPU/memory/processes, read-only access to only its own eval directory and dependencies, and a separate writable output directory.

GitHub runs three required checks: `pr-policy`, `content-validate`, and `runner-sandbox`. Community PRs require maintainer approval. The maintainer's own official or repository-maintenance PR still runs the full PR chain and is merged only through the explicitly allowed administrator bypass; direct pushes to `main` are not part of the workflow.

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

Use the exact runner documented by the eval rather than the built-in CLI scoring path:

```bash
node evals/code-er/run.mjs evals/code-er/tasks/example-answers.json --out code-er-result.json
node evals/werewolf-night/run.mjs evals/werewolf-night/tasks/example-participants.json --out werewolf-night-result.json
node evals/mc-build/run.mjs evals/mc-build/tasks/example-submission.json --out mc-build-result.json
```

Each runner rejects malformed input and duplicate or unknown flags, validates the final envelope with the shared schema, and atomically replaces the requested output. `--eval-commit` is optional and must be a 7–40 digit lowercase hexadecimal Git commit; omit it when the real eval commit is unknown.

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
