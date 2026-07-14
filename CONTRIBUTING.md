# Contributing

Keep evals reproducible, cheap to review, and explicit about both the interaction interface and who scores the result. Platform/server code never performs model calls; a CLI adapter or a documented custom runner produces a result envelope.

## Author an eval through a PR

Create a branch and scaffold the directory:

```bash
git checkout -b add-my-eval
evalhub init my-eval
```

From this monorepo, the equivalent command is:

```bash
../packages/cli/node_modules/.bin/tsx ../packages/cli/src/index.ts init my-eval
```

Complete `eval.yaml`, `README.md`, `AUTHORS`, `sample-result.json`, `tasks/README.md`, and `assets/README.md`. Put useful deterministic fixtures in `tasks/`; put only reviewable static display resources in `assets/`. A custom runner must have a literal-argv `command_template` with exactly one standalone `{output}` token and a safe slug-specific output filename.

`AUTHORS` currently supports exactly one GitHub handle, such as `@github-handle`. Every PR that adds `evals/<slug>/` must also add the byte-matching exact rule `/evals/<slug>/ @github-handle` to `.github/CODEOWNERS`; wildcard, non-anchored, duplicate, or multi-owner rules are rejected by local validation.

Run the standalone gates before opening a PR:

```bash
npm ci
npm test
npm run validate
```

The validator checks that repository ownership files agree. Requiring a CODEOWNER review before merge still depends on repository-owner GitHub branch-protection or ruleset configuration; local validation does not create or change that remote setting.

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
evalhub run cold-jokes --local ./evals --adapter api --model your-model-20260710 --out cold-jokes-result.json
```

Participant model IDs must end in a real `YYYYMMDD` or `YYYY-MM-DD` date. Chat and agent envelopes contain exactly one result; dialogue envelopes contain at least two unique participants. Harness and harness version are an optional pair on agent participants only.

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
- `scored_by=author` requires a public `scoring_note`, and submitted result scores stay `null` until the author reviews them.
- `runner=custom` requires `command_template`; `runner=builtin` must omit it.
- A local-scored result has a numeric score before submission.
