# Tasks and verdict manifest

`eval.yaml` stores all 31 stable task IDs and the complete `confirmed_task` text copied
character-for-character from the pinned upstream `data/real_world_bench.json`. The prompts
are the task statements shown by the EvalHub detail page; the accompanying `run_spec` gives
the external-workflow boundary without changing the source prompt.

| task_id | Label | Source level | Site mode |
| --- | --- | --- | --- |
| `rwb-x-openai-7d-01` | X/OpenAI weekly engagement | high | single |
| `rwb-openai-careers-apply-01` | OpenAI cloud-infrastructure application | high | multi |
| `rwb-redfin-mortgage-01` | Redfin Austin mortgage estimate | high | single |
| `rwb-expedia-flight-01` | Expedia NYC-Miami flight | high | single |
| `rwb-hn-top10-01` | Hacker News top ten | low | single |
| `rwb-imdb-scifi-01` | IMDb recent sci-fi films | medium | single |
| `rwb-calcnet-mortgage-01` | Calculator.net mortgage | medium | single |
| `rwb-cars-payment-01` | Cars.com Camry payment | high | single |
| `rwb-yahoo-stocks-01` | Yahoo Finance watchlist | low | single |
| `rwb-yelp-opentable-01` | Yelp/OpenTable Chicago anniversary dinner | high | multi |
| `rwb-reddit-greenhouse-01` | Reddit remote-engineer application | medium | single |
| `rwb-reddit-pf-indexfund-01` | Reddit index-fund posts | low | single |
| `rwb-github-trending-py-01` | GitHub trending Python | low | single |
| `rwb-bankrate-compound-01` | Bankrate compound savings | high | multi |
| `rwb-metacritic-actionrpg-01` | Metacritic Action RPG comparison | medium | single |
| `rwb-stockanalysis-tech-01` | StockAnalysis technology valuations | low | single |
| `rwb-zillow-greatschools-austin-01` | Zillow/GreatSchools Austin homes | medium | multi |
| `rwb-xe-irs-reimbursement-01` | XE/IRS reimbursement research | low | multi |
| `rwb-youtube-finance-channel-01` | YouTube personal-finance channel | medium | single |
| `rwb-amazon-bottle-leaks-01` | Amazon bottle leak reviews | medium | single |
| `rwb-houzz-homedepot-backsplash-01` | Houzz/Home Depot backsplash | medium | multi |
| `rwb-google-flights-booking-miami-01` | Google Flights/Booking Miami trip | medium | multi |
| `rwb-courtlistener-sec-helix-01` | CourtListener/SEC Helix dossier | medium | multi |
| `rwb-scratch-apple-dash-01` | Scratch Apple Dash game | medium | single |
| `rwb-2048-reach-256-01` | Classic 2048 reach 256 | medium | single |
| `rwb-song-maker-mirror-loop-01` | Chrome Song Maker mirror loop | high | single |
| `rwb-census-sba-qcew-naics541511-01` | Census/SBA/QCEW market sizing | medium | multi |
| `rwb-webflow-squarespace-wix-01` | Webflow/Squarespace/Wix audit | medium | multi |
| `rwb-nist-cisa-nvd-readiness-01` | NIST/CISA/NVD readiness | medium | multi |
| `rwb-bls-census-retail-metros-01` | BLS/Census retail-metro ranking | medium | multi |
| `rwb-lumen-ticket-rush-01` | Lumen ticket rush | high | single |

## Input manifest

Pass a JSON manifest to `pack-to-result.mjs` after an upstream run has been judged. The
manifest must have exactly these top-level fields:

```json
{
  "manifest_version": 1,
  "eval_id": "ego-browser-real-world-bench",
  "protocol_revision": 1,
  "upstream_commit": "f566ac293e4e6bd80c4e9b062b5699f04eac41f4",
  "participant": {
    "model": "your-agent-model-id",
    "harness": "your-harness",
    "harness_version": "your-harness-version"
  },
  "run_date": "YYYY-MM-DD",
  "tasks": [
    { "task_id": "rwb-x-openai-7d-01", "all_rubrics_passed": true }
  ]
}
```

The `tasks` array must contain one and only one boolean verdict for every configured task
ID. It must not include an unknown task, a duplicate, a partial rubric score, or a user-defined
denominator. The example file contains all 31 records with `false` purely to demonstrate the
shape; it is not a run artifact.

The upstream source declares an attachment for one task and a local site for another. Neither
resource is copied into this submission. Retrieve and review source-provided resources only in
your own upstream-run environment.
