# VibeLifeBench

这份 EvalHub 条目接入的是 **VibeLifeBench 完整 200 题协议**，主分数为论文披露的完整集
`avg@3`。固定来源是作者仓库 commit
`60a042e405377b89b3b00a99a45fb38039f13013` 与论文 `arXiv:2608.10875v2`。

必须把两个规模分开理解：

- 论文评测和本条目榜单覆盖 200 题，每个领域 20 题；
- 固定 GitHub 快照只公开 20 题，每个领域 2 题。EvalHub 的题目区只展示这 20 个公开任务，
  不声称它们就是完整集，也不拿 20 题成绩与论文的 200 题成绩混排。

## 分数与公开结果

每次 task run 的分数是通过检查项的权重之和除以总权重，再乘 100。标准报告协议对每题运行
3 次，先求该题三次分数的平均，再对 200 题取平均，得到 `avg@3`。`max@3`、`min@3`、
平均题内标准差、领域分数和检查类型通过率只作辅助解释，不参与第二次排名。

`published-results/official-paper-v2-2026-08-16.json` 逐行转录论文 v2 的 7 个官方结果。
每条的 `score` 都是 Table 5 的 `avg@3`；Table 5 其余列、Table 6 的十领域分数和 Table 7
的检查类型通过率保存在 `supplementary_views`。这些是上游作者发表值，不是 EvalHub 复跑，
也不是开源 20 题子集的成绩。

## 外部工作流

本条目采用 `runner: custom` 和 `custom_mode: external_workflow`。EvalHub 内的
`pack-to-result.mjs` **不运行 VibeLifeBench**；它只把已经由上游作者审核的完整 200 题报告
清单转换为 EvalHub 结果信封。

完整 200 题没有随 GitHub 发布。上游 README 指示：将模型名称、可访问的推理 endpoint 和
推理设置发给 `vibelife@evolvent.co`，由作者运行后返回分领域结果。不要把 API key 放进提交清单、
仓库或邮件正文；应通过双方认可的安全通道提供凭据。

转换命令：

```text
node evals/vibelifebench/pack-to-result.mjs <submission.json> --out <result.json>
```

输入字段见 `tasks/README.md`，结构示例见 `tasks/example-submission.json`。输出是一个仅含一条
参赛结果的 JSON 信封。转换器不读环境变量、不联网、不启动子进程，也不接触模型 endpoint。

## 上游运行环境（未验证）

固定仓库 README 的公开 20 题路径要求：

1. Docker、Python 3.12+、`uv`；
2. `uv sync` 安装钉死到 commit `7d641ea587687e7360f2bf74951b9353c2894b18` 的 Terrarium；
3. `python3 scripts/materialize_envs.py` 生成顶层环境树；
4. `./build_images.sh` 构建 22 个 mock-service 镜像；
5. 从 `models.json.example` 创建权限为 `0600` 的 `models.json`，只保留所用 provider；
6. 标准报告用 `python3 scripts/run_eval.py --model <provider/model> --attempts 3`。

上游说明 OpenClaw 版本为 2026.7.1，模型推理与 OpenClaw thinking 均使用最强设置；每个 trial
默认超时 14,400 秒。mock world 在本地容器内离线运行，正常执行时唯一业务网络目标是模型
endpoint；首次取依赖和镜像仍需要网络。运行者还需允许 Docker daemon、容器执行、工作区和
输出目录写入，并准备足够的算力、磁盘与长时间运行窗口。

**本次没有执行 benchmark、Docker 构建或 runner 校验，运行状态为未验证。** 公开 issue
[#2](https://github.com/evolvent-ai/VibeLifeBench/issues/2) 还报告了固定版本下 README 的
`think=xhigh` 配置与 Terrarium 不兼容，以及 task `PROMPT` 和虚拟时间没有按预期注入的问题。
该 issue 的单题观察不是官方基线，本目录未把它放入 `published-results/`。运行前应先由上游
确认修复版本或补丁，再保持论文协议可比性。

## 题面、授权与许可边界

VibeLifeBench 的真实输入是持续推进的 `event.yaml` 时间线。`eval.yaml` 的每条 `prompt` 完整
转录该公开任务在最初 stage 里可见的全部用户消息，方便读者理解题目，但后续通知、静默 mutation、
策略更新、服务状态和评分检查仍以固定上游任务目录为准。它不是把长程任务压成一轮对话。

投稿人已在本次提交会话中确认，获得上游授权，可在 EvalHub 复现公开 20 题的完整初始题面。
固定仓库根目录没有 `LICENSE` 文件，因此本条目不把整个仓库描述为 MIT 或其他开放许可证；
各 mock-server 子包的独立许可证也不扩大到仓库根。论文 v2 的 arXiv 记录不是 CC BY，本文只
引用论文链接和转录必要的事实/数值，不复制论文图片。

EvalHub 与 VibeLifeBench、Evolvent AI 或论文作者没有官方从属关系；本条目是经授权的第三方
提交，不代表上游作者对 EvalHub 的认证或背书。

## 目录内容

```text
evals/vibelifebench/
├── AUTHORS
├── README.md
├── eval.yaml
├── pack-to-result.mjs
├── sample-result.json
├── assets/README.md
├── tasks/
│   ├── README.md
│   └── example-submission.json
└── published-results/
    └── official-paper-v2-2026-08-16.json
```
