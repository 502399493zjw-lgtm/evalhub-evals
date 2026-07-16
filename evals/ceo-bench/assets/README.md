# assets · 归档证据摘要

首批归档成绩的来源证据包为 `ceobench_m3_glm52_analysis_pack_20260707`（2026-07-07 Asia/Shanghai 打包；两条 2026-07-06 本地单次运行）。证据文件本体不入库，此处仅登记 SHA-256 摘要以便核对：

| 文件 | SHA-256 |
| --- | --- |
| `ceobench_m3_glm52_analysis_pack_20260707.tar.gz` | `cbaa7a82e8e9d18560a62e6f88e11b74d11e7d185d0eeed77b675b972b4e67ad` |
| `ceobench_m3_glm52_pack/MANIFEST.md` | `1f3c7fabc489ce49a673ea56366eb7490cbf2518bb5c1bcb10c25662254abef8` |
| `run_ea06fe84/config.json` | `e61f116ca1970d3ad0263b25e48f72a0dc7b8b709a3d42d3ca9ed066342862e9` |
| `run_ea06fe84/checkpoint.json` | `23251e4ecf2def8a7ddf42e106b9f25b662b31d724f85adb6647806bbcf86f51` |
| `run_ea06fe84/logs/tool_results_ea06fe84.jsonl` | `3b137315bc8ed4dd17f91f3d5415d4f0314204de43954424d8680552f7c48f40` |
| `run_ea06fe84/logs/timing_ea06fe84.jsonl` | `5d6c940c5bd2ce15aaa5a11776454ba81369644cdf45df18566ce01156b5124b` |
| `run_ea06fe84/world.nmdb` | `c21973c3203e5b604b1ae27914236ff7ae6215427602f61c2663378dc4d5193e` |
| `run_6ff698f0/config.json` | `85796d711e049fe0619730a9e65ead634c413798b833cddafda5485a45e24f73` |
| `run_6ff698f0/checkpoint.json` | `6cd5aba47d8a56c14a53bfc58c4e08c689aaebf1907905fdc71121722c5ba051` |
| `run_6ff698f0/logs/tool_results_6ff698f0.jsonl` | `efd223bc37e2d0da654d4ccf93e6cd63c1ff187e68a660d92239b1e395978812` |
| `run_6ff698f0/logs/timing_6ff698f0.jsonl` | `3c10a4a3e4bbd4bdbc1a1561db46d32433b5eb2afca5fb0560bc45b9f422aec7` |
| `run_6ff698f0/world.nmdb` | `51e2ebd7931ad5c16d0991501968c40808b58cb73e22d41aeb07d0c23f24c667` |

`world.nmdb` 为 SQLCipher 加密的原始模拟器状态，仅登记哈希、不公开正文；模型原始推理不入库。
