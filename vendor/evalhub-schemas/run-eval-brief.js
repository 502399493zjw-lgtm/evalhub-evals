import { exactCliPackageSpec } from "./cli-package.js";
export class RunEvalBriefInputError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "RunEvalBriefInputError";
    }
}
const COMPLETE_GIT_COMMIT = /^[0-9a-f]{40}$/u;
/**
 * Builds the public, run-only Agent brief for a benchmark hosted in a pinned
 * upstream GitHub repository. This workflow deliberately stops after local
 * result validation and never enters the score-submission lifecycle.
 */
export function buildRunEvalBrief(definition, options) {
    const origin = siteOrigin(options.siteOrigin);
    const packageSpec = cliPackageSpecValue(options.cliPackageSpec);
    const upstream = definition.upstream;
    if (upstream === undefined) {
        throw new RunEvalBriefInputError("missing_upstream", "Run brief requires a declared upstream GitHub repository and commit.");
    }
    if (!COMPLETE_GIT_COMMIT.test(upstream.commit)) {
        throw new RunEvalBriefInputError("incomplete_upstream_commit", "Run brief requires a complete 40-character lowercase Git commit.");
    }
    const repositoryUrl = `https://github.com/${upstream.repo}.git`;
    const output = definition.command_template?.output ?? `${definition.id}-result.json`;
    const usesLegacyAdapter = definition.runner === "custom" &&
        definition.custom_mode === "external_workflow" &&
        definition.command_template != null;
    const detailUrl = `${origin}/e/${encodeURIComponent(definition.id)}`;
    const briefUrl = `${origin}/api/evals/${encodeURIComponent(definition.id)}?format=brief`;
    const workspace = `${definition.id}-upstream`;
    const resultStep = usesLegacyAdapter
        ? [
            "上游 Benchmark 完成后，保留它生成的真实原始结果。此评测声明了 legacy `external_workflow + command_template` result adapter；先审阅 adapter 的固定来源与命令，再在用户同意执行第三方代码后转换为 result-v1：",
            shellBlock(`EVALHUB_PLATFORM_URL=${shellToken(origin)} evalhub pack ${shellToken(definition.id)} --input /path/to/upstream-result.json --out ${shellToken(output)} --allow-custom-code`),
            "`evalhub pack` 只用于结果转换，不负责安装或运行上游 Benchmark，也不表示第三方 adapter 已被 OS sandbox。",
        ].join("\n\n")
        : [
            "此评测没有声明 EvalHub result adapter。只有当上游流程已经生成符合 EvalHub result-v1 的结果文件时才继续；不要自行发明转换逻辑。",
            `将真实 result-v1 文件保存为 ${shellToken(output)}，或在下面校验命令中替换为它的实际本地路径。`,
        ].join("\n\n");
    return `---
schema: evalhub-run-brief/v1
eval: ${jsonScalar(definition.id)}
upstream_repo: ${jsonScalar(upstream.repo)}
upstream_commit: ${jsonScalar(upstream.commit)}
detail_url: ${jsonScalar(detailUrl)}
brief_url: ${jsonScalar(briefUrl)}
result_format: result-v1
---

# ${singleLineHeading(definition.name)} · 运行评测

这是一个 **run-only** 工作流。目标是按上游项目自己的文档完成 Benchmark，产出并校验本地结果文件，然后停止。

## 固定来源

- GitHub 仓库：\`${upstream.repo}\`
- 完整 commit：\`${upstream.commit}\`
- 项目地址：${repositoryUrl}

不得改用默认分支、tag、最新 release 或其他 commit，也不得猜测替代仓库。

## 1. 准备工具并检出固定版本

安装平台指定的精确版本 CLI：

${shellBlock(`npm install -g ${shellToken(packageSpec)}`)}

在新的本地目录中 clone 仓库、只 fetch 登记的完整 commit、以 detached HEAD 检出，并验证 HEAD 完全一致。不要使用任何已有同名目录：

${shellBlock([
        `test ! -e ${shellToken(workspace)}`,
        `git clone --no-checkout ${shellToken(repositoryUrl)} ${shellToken(workspace)}`,
        `git -C ${shellToken(workspace)} fetch --force --no-tags origin ${shellToken(upstream.commit)}`,
        `git -C ${shellToken(workspace)} checkout --detach FETCH_HEAD`,
        `test "$(git -C ${shellToken(workspace)} rev-parse HEAD)" = ${shellToken(upstream.commit)}`,
    ].join("\n"))}

如果 clone、fetch、detached checkout 或 HEAD 核对失败，立即停止并报告，不要回退到 branch、tag 或别的 commit。

## 2. 阅读固定 commit 的运行契约

只阅读并遵循该 detached checkout 中的 README 和它明确引用的固定版本文档。开始执行前，向用户说明：

- 安装步骤、第三方依赖、系统要求和预计资源消耗；
- 网络、凭证、权限、数据许可与外部服务要求；
- 上游推荐的 Docker、容器、虚拟机或其他隔离环境；优先使用上游已声明的隔离方式；
- 最小可运行示例、正式 Benchmark Runner 入口、Scorer 入口和结果输出位置。

如果 README 没有明确声明安装、运行 Benchmark Runner 或使用 Scorer 的入口，立即停止，列出缺失的契约并请用户处理；不要猜测命令。

## 3. 按上游方式运行 Benchmark

1. 先在上游推荐的 Docker/隔离环境中执行 README 声明的最小示例，确认环境与依赖可用。
2. 再使用上游项目声明的 Runner 运行正式 Benchmark；不要把 EvalHub CLI 当作 Benchmark 执行器。
3. 使用上游项目声明的 Scorer 评分；不要自行替换指标、Judge、权重或评分规则。
4. 保存真实的原始结果、日志和必要 evidence，并记录实际命令与当前 HEAD。

任何依赖、Runner、Scorer、输入或输出契约不明确时，都应停止并报告，不要猜测或静默修补。

## 4. 产出 result-v1

${resultStep}

## 5. 只做本地校验，然后停止

校验最终结果文件：

${shellBlock(`EVALHUB_PLATFORM_URL=${shellToken(origin)} evalhub validate ${shellToken(output)}`)}

校验成功后，向用户报告：

- 上游仓库与完整 commit；
- 实际使用的 Runner、Scorer 和环境；
- 最终本地结果文件的绝对路径；
- \`evalhub validate\` 的结果。

到此停止，不要进入任何后续流程。
`;
}
function siteOrigin(value) {
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        throw new Error("siteOrigin must be an absolute HTTP(S) origin");
    }
    if (!["http:", "https:"].includes(parsed.protocol) ||
        parsed.username !== "" ||
        parsed.password !== "" ||
        parsed.pathname !== "/" ||
        parsed.search !== "" ||
        parsed.hash !== "") {
        throw new Error("siteOrigin must be an absolute HTTP(S) origin");
    }
    return parsed.origin;
}
function cliPackageSpecValue(value) {
    return exactCliPackageSpec(value);
}
function jsonScalar(value) {
    return JSON.stringify(value);
}
function singleLineHeading(value) {
    return value.replace(/[\r\n]+/gu, " ").replace(/\s+/gu, " ").trim();
}
function shellBlock(command) {
    return `\`\`\`bash\n${command}\n\`\`\``;
}
function shellToken(value) {
    if (/^[A-Za-z0-9_@%+=:,./-]+$/u.test(value))
        return value;
    return `'${value.replace(/'/gu, `'"'"'`)}'`;
}
