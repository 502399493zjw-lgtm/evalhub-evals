# CivBench

This directory is a lightweight EvalHub record for CivBench's Ground Control profile. The complete benchmark, game integration, save, runner, scorers, and telemetry pipeline remain in the upstream project; this directory contains only the pinned protocol mapping, deterministic result packer, a bounded synthetic fixture, and a traceable official-results snapshot.

## Protocol

- EvalHub slug: `civbench`
- Protocol revision: `1`
- Upstream code: `lmwilki/civ6-mcp` at `dd2019056371b92ea4854e879ddf05a8cad95e8a` (`v1.1.11`)
- Official data snapshot: `civbench/civbench-v1` at `2d9937d1e273a18fbe0e9e8f32325d4d6cb61dea`
- Included profile: `ground_control` on `civbench_standard`
- Required cut: `admissible == true`
- Main score: mean of all eight 0–100 dimension scores within each game, then mean across every included game
- Ranking direction: higher is better
- Supplementary only: dimension means, raw in-game score, outcome, and run count; upstream ELO does not affect the EvalHub score

`trials: 1` records the upstream runner's default of one run per model/scenario pair. A submission may repeat the identical fixed profile; when it does, it must include all admissible runs and the packer reports their arithmetic mean and run count. The published snapshot preserves the upstream public coverage as released, so three models have six Ground Control runs and Kimi-K2.5 has one.

All four source model versions have exact canonical entries in the EvalHub model registry. The published-results envelope preserves the source labels in each result detail and maps them explicitly to `google/gemini-3.1-pro-preview`, `openai/gpt-5.4`, `anthropic/claude-opus-4-6`, and `moonshot/kimi-k2.5`; no result is silently dropped or guessed to be a different model version.

## Upstream installation and invocation

Review the pinned code before running it. In a user-controlled environment:

```bash
git clone https://github.com/lmwilki/civ6-mcp.git
cd civ6-mcp
git checkout dd2019056371b92ea4854e879ddf05a8cad95e8a
uv sync --extra evals
uv run python evals/runner.py \
  --model <provider/model> \
  --scenarios ground_control \
  --track civbench_standard \
  --runs 1
```

Keep the bundled `0A_GROUND_CONTROL.Civ6Save` and scenario configuration unchanged. The upstream workflow produces Inspect logs and CivBench diary telemetry; the pinned upstream analysis code derives the eight dimensions. The EvalHub packer does not replace that workflow—it accepts its already established run metadata and dimension scores.

## External input and output

Create a JSON manifest matching [`tasks/example-submission.json`](tasks/example-submission.json), then use the local packer only after reviewing it:

```bash
node evals/civbench/pack-to-result.mjs <submission.json> --out civbench-result.json
```

The formal EvalHub command uses the standalone `{input}` and `{output}` tokens declared in `eval.yaml`; it never hard-codes the synthetic example. The packer requires:

- manifest version, eval id, protocol revision, pinned upstream commit, participant identity, and a real run date;
- one or more unique Ground Control game records;
- `scenario_id: ground_control`, `eval_track: civbench_standard`, and `admissible: true`;
- a published upstream `run_id`, terminal outcome, raw in-game score, and all eight finite 0–100 dimension scores.

It rejects unknown fields, duplicate run ids, missing dimensions, other scenarios/tracks, non-admissible records, non-finite values, and malformed dates. It emits a result-v1 JSON envelope with one numeric score and a stable supplementary metric table. The adapter verifies structure and arithmetic only; it cannot establish that an external run really occurred or that the upstream admissibility decision is correct.

## Runtime requirements and permissions

The upstream workflow requires:

- a macOS, Windows, or native Linux machine capable of running the Steam version of Civilization VI with Gathering Storm;
- FireTuner enabled on TCP port 4318; Windows additionally requires the Civ VI SDK, and Linux GUI automation requires X11-compatible tools;
- Python 3.12+, `uv`, Inspect AI and OS-specific launcher dependencies when GUI automation is used;
- model-provider credentials and outbound network access for model APIs; upstream analysis/publication may also require telemetry and object-storage access controlled by the upstream operator;
- permission to start/stop the game, connect to a local TCP port, read/write saves, logs and temporary files, and, for launcher automation, control the graphical desktop;
- enough wall-clock time and provider quota for a 300+ turn game. The runner permits up to ten minutes per API call and retries transient model errors.

## Known limitations and boundaries

- This EvalHub revision includes only Ground Control. Snowflake and Cry Havoc are upstream scenarios but are outside this comparison boundary.
- The official Hugging Face snapshot is a released publication, not a fresh run at the pinned repository commit. Its 19 selected rows carry several earlier `gitDescribe` values; this is disclosed rather than normalized away.
- Public model coverage is uneven. A one-run mean is more sensitive to game variance than a six-run mean.
- The eight-dimension analysis consumes full game telemetry and logs. Some upstream analysis paths use the author's Convex/Azure services and may require network access or credentials not supplied by EvalHub.
- Upstream ELO pools canonical completed games across scenarios and uses its own player normalization. It is supplementary context only and is not recomputed for the Ground Control-only EvalHub score.
- EvalHub does not host or redistribute Civilization VI, the Gathering Storm DLC, or their license. Users must obtain and operate them under the applicable terms.
- EvalHub has not audited, endorsed, or verified the upstream runtime. Use a container, virtual machine, separate OS account, or other isolation if appropriate for your risk model.

## Source ledger

| Source | Fixed boundary | Fact mapped into this package |
| --- | --- | --- |
| [Civ6-MCP repository](https://github.com/lmwilki/civ6-mcp/tree/dd2019056371b92ea4854e879ddf05a8cad95e8a) | commit `dd2019056371b92ea4854e879ddf05a8cad95e8a`, tag `v1.1.11`, MIT | benchmark purpose, runtime, interface, runner and implementation boundary |
| [Ground Control definition](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/evals/scenarios.py) | same commit | exact objective, civilization, map, difficulty and 330-turn budget |
| [Bulk runner](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/evals/runner.py) | same commit | standard track, one-game-at-a-time invocation and default run count |
| [Analysis scorer](https://github.com/lmwilki/civ6-mcp/blob/dd2019056371b92ea4854e879ddf05a8cad95e8a/scripts/analyze.py) | same commit | eight dimensions and arithmetic-mean AGGREGATE formula |
| [Official dataset](https://huggingface.co/datasets/civbench/civbench-v1/tree/2d9937d1e273a18fbe0e9e8f32325d4d6cb61dea) | commit `2d9937d1e273a18fbe0e9e8f32325d4d6cb61dea`, CC BY 4.0 | canonical admissibility rule and published Ground Control result rows |
| [Pinned games.parquet](https://huggingface.co/datasets/civbench/civbench-v1/blob/2d9937d1e273a18fbe0e9e8f32325d4d6cb61dea/tables/games.parquet) | SHA-256 `31250d37a837d2f659bada53ad5cede82091f22be66474c9a6e5b03b5e9fad39` | 19-row filtered baseline, model ids, dimensions, raw score and outcomes |

No paper or DOI is claimed. The official dataset README supplies a BibTeX `@misc` citation and is linked from the pinned snapshot.
