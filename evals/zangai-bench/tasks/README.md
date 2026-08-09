# 题目数据与提交清单

`graph.json` 是新版 `graph-engineering-v2` 的唯一输入数据。运行前将它放到参赛 Agent 工作目录的 `data/graph.json`：

```text
sha256  f83313f6e50b2f1bb809c9c1fc0de2217c437e33b1fa417b571b6527b7df988e
nodes   649
links   1699
types   company=165, person=135, product=337, vc_firm=12
```

16 种关系的精确数量为：

| type | count | type | count |
| --- | ---: | --- | ---: |
| acquires | 6 | co_founded | 7 |
| collaborates_with | 19 | compares_to | 644 |
| competes_with | 348 | criticizes | 21 |
| develops | 189 | founder_of | 73 |
| integrates_with | 117 | invests_in | 84 |
| mentors | 3 | partners_with | 28 |
| praises | 28 | related | 2 |
| works_at | 85 | works_on | 45 |

`example-submission.json` 演示转换器清单结构。十轮分数使用固定的合成序列 10、20、…、100，平均为 55；证据摘要是字符串 `zangai-bench-fixture-round-N` 的 sha256。它们不来自模型运行，不是发布成绩。

真实提交必须保持 `eval.yaml` 与 `README.md` 中列出的版本和摘要，并将每轮原始工作目录、浏览器评分 JSON 与日志打成证据包后填写其 sha256。作者核验通过前，转换成功只代表结构合规，不代表成绩被认可。
