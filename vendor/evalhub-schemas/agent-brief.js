import { exactCliPackageSpec } from "./cli-package.js";
import { buildRunEvalBrief } from "./run-eval-brief.js";
const GITHUB_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const COMPLETE_GIT_COMMIT = /^[0-9a-f]{40}$/u;
/**
 * Legacy-compatible entry point for Agent briefs.
 *
 * Run instructions are available only when the eval points at a public,
 * precisely pinned GitHub upstream. Older task and pairing arguments remain
 * accepted for callers that still pass them, but are intentionally ignored.
 */
export function buildAgentBrief(definition, options) {
    const origin = siteOrigin(options.siteOrigin);
    const cliPackageSpec = exactCliPackageSpec(options.cliPackageSpec);
    const upstream = definition.upstream;
    if (upstream !== undefined &&
        GITHUB_REPOSITORY.test(upstream.repo) &&
        COMPLETE_GIT_COMMIT.test(upstream.commit)) {
        return buildRunEvalBrief(definition, {
            siteOrigin: origin,
            cliPackageSpec,
        });
    }
    return buildUnavailableBrief(definition, origin);
}
function buildUnavailableBrief(definition, origin) {
    const detailUrl = `${origin}/e/${encodeURIComponent(definition.id)}`;
    const briefUrl = `${origin}/api/evals/${encodeURIComponent(definition.id)}?format=brief`;
    return `---
schema: evalhub-run-brief/unavailable/v1
eval: ${yamlScalar(definition.id)}
detail_url: ${yamlScalar(detailUrl)}
brief_url: ${yamlScalar(briefUrl)}
status: "unavailable"
---

# ${singleLineHeading(definition.name)} · 暂无法生成运行说明

当前无法生成运行评测 Brief。

要运行这套评测，需要：

- 一个公开的 GitHub upstream 仓库；
- \`owner/repo\` 格式的仓库标识；
- 完整 40 位小写 Git commit；
- 仓库 README 中明确的安装、Runner、Scorer 和结果输出方式。

请先补充或确认这些来源信息，再重新生成运行说明。

此入口只说明缺少运行来源，不会安装、运行、转换或处理结果，也不会执行任何命令。
`;
}
function siteOrigin(raw) {
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        throw new Error("siteOrigin must be an absolute HTTP(S) origin");
    }
    const loopbackHttp = url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if ((url.protocol !== "https:" && !loopbackHttp) ||
        url.username ||
        url.password ||
        (url.pathname !== "" && url.pathname !== "/") ||
        url.search ||
        url.hash) {
        throw new Error("siteOrigin must be an absolute HTTP(S) origin");
    }
    return url.origin;
}
function singleLineHeading(value) {
    const normalized = value
        .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
    return normalized || "Eval";
}
function yamlScalar(value) {
    return JSON.stringify(value);
}
