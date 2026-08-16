# EvalHub Author Reader Table Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the official EvalHub author skill to preserve complete source tables and verify the platform's bounded long-table presentation before handoff.

**Architecture:** Keep data authorship separate from platform styling. The eval package stores every supported participant and table row; the author skill and its evidence references require a local or uploaded preview to verify the eight-row presentation contract without treating hidden-by-default rows as missing data.

**Tech Stack:** Markdown, YAML authoring guidance, Codex Skills, repository validation

## Global Constraints

- This is a repository-maintenance PR and must not contain an EvalHub submission marker.
- Do not modify any `evals/<slug>/` directory.
- Do not merge or deploy from this task.
- Never delete or synthesize source data to satisfy a presentation limit.

---

### Task 1: Add the source-complete table rule to the author skill

**Files:**
- Modify: `.agents/skills/evalhub-author-reader/SKILL.md`
- Modify: `.agents/skills/evalhub-author-reader/references/content-and-evidence-contract.md`
- Modify: `.agents/skills/evalhub-author-reader/references/golden-reader-patterns.md`

**Interfaces:**
- Consumes: source-ledger-backed Markdown result and protocol tables
- Produces: complete stored rows plus an explicit preview acceptance contract

- [ ] **Step 1: Define the Markdown table ownership boundary**

  Require authors to preserve every supported row in one source-faithful table and prohibit truncating, splitting, or deleting official participants merely to fit the initial viewport.

- [ ] **Step 2: Define the long-table preview behavior**

  For every Markdown table with more than eight body rows, require exactly eight initially visible rows, one `展开其余 N 行` control with the correct remainder, expansion to all rows, and `收起至 8 行`. Require no expansion control at eight rows or fewer and horizontal access at narrow widths.

- [ ] **Step 3: Extend CEO-style and reader-readiness guidance**

  Clarify that a compact initial presentation never authorizes a truncated official leaderboard or breakdown. Add the same complete-row and control checks to `榜单` and `官方分项结果`.

### Task 2: Keep repository-facing guidance synchronized

**Files:**
- Modify: `CONTRIBUTING.md`
- Modify: `llms.txt`

**Interfaces:**
- Consumes: the author-skill contract from Task 1
- Produces: concise repository instructions that route Agents to the same behavior

- [ ] **Step 1: Add the complete-table authoring rule beside Markdown guidance**
- [ ] **Step 2: Add preview verification beside the existing pre-PR validation workflow**
- [ ] **Step 3: Confirm the instructions do not imply that repository validation or preview executes a third-party runner**

### Task 3: Validate and submit the skill maintenance PR

**Files:**
- Review: all files listed above

**Interfaces:**
- Consumes: the synchronized skill and repository instructions
- Produces: one open, unmerged GitHub PR

- [ ] **Step 1: Validate the skill package**

  Run:

  ```bash
  python3 /Users/edisonzhong/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/evalhub-author-reader
  npm ci --ignore-scripts
  npm run validate
  git diff --check
  ```

  Expected: every command passes and the diff contains no eval-directory changes.

- [ ] **Step 2: Commit with `docs(skill): verify complete long-table previews`**
- [ ] **Step 3: Push `codex/author-reader-table-preview` and open a repository-maintenance PR without a submission marker**
- [ ] **Step 4: Report the PR URL and current checks without merging**
