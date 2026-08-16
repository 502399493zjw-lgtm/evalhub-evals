# RSIBench Reader Structure Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RSIBench-Data the single reader-page structure standard, rebuild CEO-Bench, Ego Browser Real-World Bench, Terminal-Bench, and GameCraft-Bench against that standard, and prove the five pages have the same module order and interaction contract in staging.

**Architecture:** The platform-native structured `detail_profile` is canonical. Eval files own source-backed protocol content; `published-results` owns leaderboard and official breakdown data; `tasks[]` owns task cases. A repository skill and deterministic structure reporter enforce the shared module signature `hero > leaderboard > official-breakdown > about > task-cases > resources` before visual staging checks.

**Tech Stack:** YAML, JSON, Node.js 22, `yaml`, EvalHub repository validators, GitHub pull requests, EvalHub staging, in-app browser inspection.

## Global Constraints

- Preserve every target `AUTHORS` file byte-for-byte.
- Preserve protocol, task, result, and source facts; this is a reader-structure migration, not a benchmark revision.
- Keep `protocol_revision` unchanged unless scoring protocol or task identity changes.
- Keep each eval change inside exactly one `evals/<slug>/` and submit one eval per PR.
- Keep skill and validator changes in a separate repository-maintenance PR.
- Never remove leaderboard rows, breakdown rows, tasks, figures, or sources to satisfy layout.
- Deploy to staging only; production remains untouched.

---

### Task 1: Capture the RSIBench canonical contract and current drift

**Files:**
- Inspect: `evals/rsibench-data/eval.yaml`
- Inspect: `evals/rsibench-data/published-results/*.json`
- Inspect: `evals/{ceo-bench,ego-browser-real-world-bench,terminal-bench,gamecraft-bench}/eval.yaml`

- [x] Record the canonical structured `detail_profile` fields and five rendered modules.
- [x] Record current target field sets, result-view contracts, task counts, and rendered heading order.
- [x] Confirm historical structured profiles can be recovered without changing benchmark facts.

### Task 2: Redesign the authoring skill around one RSIBench reader architecture

**Files:**
- Modify: `.agents/skills/evalhub-author-reader/SKILL.md`
- Modify: `.agents/skills/evalhub-author-reader/references/golden-reader-patterns.md`
- Modify: `.agents/skills/evalhub-author-reader/references/content-and-evidence-contract.md`
- Create: `.agents/skills/evalhub-author-reader/references/rsibench-reader-contract.md`
- Create: `.agents/skills/evalhub-author-reader/scripts/report-reader-structure.mjs`
- Test: `.agents/skills/evalhub-author-reader/scripts/report-reader-structure.test.mjs`

- [x] Replace page-level CEO/RSI pattern branching with one canonical module contract.
- [x] Define structured `detail_profile` as the default and Markdown as an evidence-driven exception only.
- [x] Specify field-to-module ownership, required order, empty-state behavior, and preservation rules.
- [x] Add a deterministic reporter that derives semantic module signatures and flags drift.
- [x] Add passing and failing fixtures in a self-contained Node test.
- [x] Run the skill creator validator, maintenance tests, and repository validation.
- [ ] Commit, push, open, check, and merge the skill PR.

### Task 3: Rebuild CEO-Bench from the unified skill

**Files:**
- Modify: `evals/ceo-bench/eval.yaml`
- Preserve: `evals/ceo-bench/AUTHORS`
- Preserve: `evals/ceo-bench/published-results/official-leaderboard-2026-08-16.json`

- [ ] Map the complete source-backed Markdown content into the canonical structured fields.
- [ ] Confirm leaderboard, official run statistics, task case, and resources are platform-owned modules.
- [ ] Run content validation and the structure reporter against RSIBench.
- [ ] Commit, push, open, check, and merge the CEO-Bench PR.

### Task 4: Rebuild Ego Browser Real-World Bench from the unified skill

**Files:**
- Modify: `evals/ego-browser-real-world-bench/eval.yaml`
- Preserve: `evals/ego-browser-real-world-bench/AUTHORS`
- Preserve: `evals/ego-browser-real-world-bench/published-results/official-leaderboard-2026-08-04.json`

- [ ] Map the complete source-backed Markdown content into the canonical structured fields.
- [ ] Preserve all 31 tasks and both official supplementary-view contracts.
- [ ] Run content validation and the structure reporter against RSIBench.
- [ ] Commit, push, open, check, and merge the Ego Browser PR.

### Task 5: Rebuild Terminal-Bench from the unified skill

**Files:**
- Modify: `evals/terminal-bench/eval.yaml`
- Preserve: `evals/terminal-bench/AUTHORS`
- Preserve: `evals/terminal-bench/published-results/official-leaderboard-2026-08-10.json`

- [ ] Map the complete source-backed Markdown content into the canonical structured fields.
- [ ] Preserve all 74 tasks and the official run-statistics view.
- [ ] Run content validation and the structure reporter against RSIBench.
- [ ] Commit, push, open, check, and merge the Terminal-Bench PR.

### Task 6: Rebuild GameCraft-Bench from the unified skill

**Files:**
- Modify: `evals/gamecraft-bench/eval.yaml`
- Preserve: `evals/gamecraft-bench/AUTHORS`
- Preserve: `evals/gamecraft-bench/published-results/official-leaderboard-2026-08-10.json`

- [ ] Map the complete source-backed Markdown content into the canonical structured fields.
- [ ] Preserve all 140 tasks, complete official results, task-family tables, rubric evidence, and figures.
- [ ] Run content validation and the structure reporter against RSIBench.
- [ ] Commit, push, open, check, and merge the GameCraft-Bench PR.

### Task 7: Deploy and compare until the reader structure is unified

**Files:**
- Inspect: staging pages `/e/rsibench-data`, `/e/ceo-bench`, `/e/ego-browser-real-world-bench`, `/e/terminal-bench`, `/e/gamecraft-bench`

- [ ] Deploy the merged eval repository revision to staging.
- [ ] Compare H1/H2 module order, section presence, table row counts, task controls, and resource cards on all five pages.
- [ ] Verify every table shows at most eight initial rows and expands to the complete stored row set.
- [ ] Compare wide and narrow viewport screenshots for hierarchy and overflow regressions.
- [ ] If any structural drift remains, fix it in the owning skill, eval data, or platform renderer and repeat validation.
- [ ] Record final PRs, merged commits, staging revision, and staging URLs.
