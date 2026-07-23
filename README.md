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
```

The three custom launch evals have slug-specific outputs:

```bash
node evals/code-er/run.mjs evals/code-er/tasks/example-answers.json --out code-er-result.json
node evals/werewolf-night/run.mjs evals/werewolf-night/tasks/example-participants.json --out werewolf-night-result.json
node evals/mc-build/run.mjs evals/mc-build/tasks/example-submission.json --out mc-build-result.json
```

Custom runners validate their inputs and result envelopes locally. They do not call a model service. See each eval README for its input limits and scoring semantics, and see `CONTRIBUTING.md` for authoring and submission workflows.
