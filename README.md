# EvalHub Evals

This standalone repository is the source of truth for EvalHub evaluations. Every `evals/<slug>/` directory contains a complete, reviewable contract:

- non-empty `eval.yaml`, `README.md`, `AUTHORS`, and `sample-result.json`;
- `tasks/README.md` plus any eval-specific example inputs;
- `assets/README.md` plus any static showcase assets;
- for `runner=custom`, an exact `command_template` and its documented runner.

Install the pinned dependencies, run the contract tests, and validate all evals:

```bash
npm ci
npm test
npm run validate
npm run validate:runner
```

The last command executes custom runners in a locked Docker container. Contributions are accepted only through GitHub PRs: one PR may create or update one slug, the PR creator must match that eval's `AUTHORS`, and repository review remains with `@502399493zjw-lgtm`. See `CONTRIBUTING.md` for the complete ownership, file-safety, and sandbox rules.

The three custom launch evals have slug-specific outputs:

```bash
node evals/code-er/run.mjs evals/code-er/tasks/example-answers.json --out code-er-result.json
node evals/werewolf-night/run.mjs evals/werewolf-night/tasks/example-participants.json --out werewolf-night-result.json
node evals/mc-build/run.mjs evals/mc-build/tasks/example-submission.json --out mc-build-result.json
```

Custom runners validate their inputs and result envelopes locally. They do not call a model service. See each eval README for its input limits and scoring semantics, and see `CONTRIBUTING.md` for authoring and submission workflows.
