# EvalHub Evals

This standalone repository is the source of truth for EvalHub evaluations. Every `evals/<slug>/` directory contains a complete, reviewable contract:

- non-empty `eval.yaml`, `README.md`, `AUTHORS`, and `sample-result.json`;
- `tasks/README.md` plus any eval-specific example inputs;
- `assets/README.md` plus any static showcase assets;
- for `runner=custom`, an exact `command_template` and its documented runner.

Install the pinned dependencies without lifecycle scripts and run the required lightweight content gate:

```bash
npm ci --ignore-scripts
npm run validate
```

This gate validates repository scope, ownership metadata, schemas, references, provenance fields, and repository-file safety. It does not require Docker and never executes a third-party runner. `npm run test:maintenance` is reserved for changes to repository infrastructure such as validators, schemas, vendored contracts, or CI; it is not a gate for an ordinary `evals/<slug>/` contribution.

Contributions are accepted only through GitHub PRs: one PR may create, restore, or update one slug, and the trusted PR policy binds ownership to canonical `AUTHORS` history. A previously deleted slug retains that owner and cannot be reclaimed by re-adding it; an invalid active restoration must be repaired before any other eval change, and an ownership transfer is a separate maintainer-only PR. Repository review remains with `@502399493zjw-lgtm`. See `CONTRIBUTING.md` for the complete ownership, content-safety, provenance, and runner-responsibility rules.

EvalHub-hosted services and repository automation do not execute third-party runners, and EvalHub does not audit or guarantee them. Runners are downloaded and executed only in users' own environments, either directly or through a local tool after explicit confirmation. Users should review the source and code before running one and decide whether to use a container, virtual machine, or other isolation measures. Repository checks cover metadata syntax, referenced paths, schemas, and repository-file safety only; passing them does not establish that a runner is safe, compatible, or runnable.

A runner's documentation should record:

1. its upstream repository or source URL;
2. a pinned commit, tag, or release;
3. installation and invocation instructions;
4. input and output conventions;
5. required network access, tools, compute, and permissions;
6. known limitations.

For example, the currently checked-in custom converter can be invoked manually after review with a slug-specific output:

```bash
node evals/rsibench-data/pack-to-result.mjs evals/rsibench-data/tasks/example-submission.json --out rsibench-data-result.json
```

See each eval README for the runner's declared requirements, input limits, output contract, and scoring semantics. EvalHub validates result-envelope format when content is submitted or imported but does not verify the runner that produced it. Any EvalHub CLI feature that can launch a third-party runner must show its source and the risk boundary before the first run, require explicit user confirmation, and must not display a claim such as "security verified."
