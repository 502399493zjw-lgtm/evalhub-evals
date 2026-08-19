# Tasks and external submission manifest

`eval.yaml` contains the complete, verbatim Ground Control objective from the pinned upstream scenario. The only checked-in task fixture is `example-submission.json`, a bounded synthetic example of the external result manifest; it is documentation, not an official score, game trace, EvalHub execution input, or baseline.

Real runs happen in the pinned Civ6-MCP repository and require the environment documented in the top-level README. After the external workflow has established admissibility and produced all eight upstream dimension scores, supply the manifest to:

```bash
node evals/civbench/pack-to-result.mjs <submission.json> --out civbench-result.json
```

The formal `command_template` injects a participant-provided `{input}` path and never points at this example. Every game object must use the Ground Control standard-track boundary and a unique upstream run id. The packer computes only the documented arithmetic mean and does not replay, score, audit or authenticate the game.
