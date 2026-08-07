import { resolveCustomRunnerMode, resolveScorePolicy, } from "./eval-def.js";
const CLI_PACKAGE_SPEC = "@evalhub/cli";
const OPAQUE_TASK_ID = /^task_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PAIRING_CODE = /^[0-9A-HJ-NP-TV-Z]{4}(?:-[0-9A-HJ-NP-TV-Z]{4}){4}$/u;
export function buildAgentBrief(definition, options) {
    const origin = siteOrigin(options.siteOrigin);
    const cliPackageSpec = cliPackageSpecValue(options.cliPackageSpec);
    const taskId = options.taskId === undefined ? null : opaqueTaskId(options.taskId);
    const pairingCode = options.pairingCode === undefined ? null : platformPairingCode(options.pairingCode);
    const briefUrl = `${origin}/api/evals/${encodeURIComponent(definition.id)}?format=brief`;
    const detailUrl = `${origin}/e/${encodeURIComponent(definition.id)}`;
    const taskUrl = taskId === null ? null : `${origin}/submit/tasks/${encodeURIComponent(taskId)}`;
    const startUrl = `${detailUrl}?submit=1`;
    const cost = definition.est_tokens
        ? `预计约 ${definition.est_tokens} tokens；先向用户确认成本预算。`
        : "成本未知，先小样本试跑。";
    const output = definition.command_template?.output ?? `${definition.id}-result.json`;
    const platformEnvironment = `EVALHUB_PLATFORM_URL=${shellToken(origin)}`;
    const customMode = resolveCustomRunnerMode(definition);
    const pinnedDependencyInstall = [
        "先遵循已经审查过的 README。CLI 会打印 `Pinned checkout root: <绝对路径>`；如果该根目录存在 package-lock.json（或 README 明确要求安装其中的 Node 依赖），再对 CLI 打印的实际根目录安装锁定依赖，禁止省略 `--ignore-scripts`：",
        shellBlock('npm ci --ignore-scripts --prefix "<CLI 打印的 Pinned checkout root 绝对路径>"'),
        "`--prefix` 会让终端留在最初运行 EvalHub 的工作目录，后续 run/pack 必须继续从该目录执行，才能复用同一个 pinned checkout。CLI 不会自动安装依赖。你只可在用户确认后运行上述命令，不得修改或绕过 pinned checkout 的洁净性检查；没有 package-lock.json 且 README 未要求时，不要擅自运行 npm ci。",
    ].join("\n\n");
    const execution = customMode === "external_workflow"
        ? [
            `这是需要外部基础设施的自定义评测。详情页：${detailUrl}`,
            `先让 CLI 下载平台钉死的源码 commit，但不执行：\n\n${shellBlock(`${platformEnvironment} evalhub fetch ${shellToken(definition.id)}`)}`,
            "检查 CLI 打印的本地源码目录、固定 commit、README、依赖、权限、网络访问和环境变量使用。如果源码链接或 commit 缺失、无法核对，就停下询问。",
            pinnedDependencyInstall,
            "严格按 README 在评测指定的外部基础设施完成全部独立运行，保存真实 submission JSON；示例 JSON 只用于理解格式，不能作为提交输入。",
            `外部运行全部完成后，用真实 submission JSON 打包结果（把 /path/to/submission.json 替换成实际文件路径）：\n\n${shellBlock(`${platformEnvironment} evalhub pack ${shellToken(definition.id)} --input /path/to/submission.json --out ${shellToken(output)}`)}`,
        ].join("\n\n")
        : customMode === "executable"
            ? [
                `这是自定义 runner。详情页：${detailUrl}`,
                `先让 CLI 下载平台钉死的源码 commit，但不执行：\n\n${shellBlock(`${platformEnvironment} evalhub fetch ${shellToken(definition.id)}`)}`,
                "runner 及其依赖是不受平台信任的第三方代码。检查 CLI 打印的本地源码目录、commit、README、依赖、权限、网络访问和环境变量使用；把执行计划与命令给用户看，得到用户明确确认后才执行。如果固定源码链接或 commit 缺失、无法核对，就停下询问。",
                pinnedDependencyInstall,
                "使用最小权限和最少环境变量运行；不得把整个 process.env 或与本评测无关的 API key 交给 runner。",
                definition.command_template
                    ? `确认后通过 CLI 执行已下载的固定版本：\n\n${shellBlock(`${platformEnvironment} evalhub run ${shellToken(definition.id)} --out ${shellToken(output)} --allow-custom-code`)}`
                    : "评测尚未发布可执行命令；不要猜测命令，先查看源码 README。",
            ].join("\n\n")
            : [
                definition.scoring === "judge"
                    ? "执行前，请用户本人只在即将运行 CLI 的本地终端配置 EVALHUB_MODEL_BASE_URL、EVALHUB_MODEL_API_KEY 和 EVALHUB_JUDGE_API_KEY。Agent 不得索要、读取、记录或回显这些密钥，也不得将它们写入命令、日志或评测产物。用户确认配置完成后再继续。"
                    : "执行前，请用户本人只在即将运行 CLI 的本地终端配置 EVALHUB_MODEL_BASE_URL 和 EVALHUB_MODEL_API_KEY。Agent 不得索要、读取、记录或回显密钥，也不得将密钥写入命令、日志或评测产物。用户确认配置完成后再继续。",
                "把下面示例值替换为用户已确认的模型 ID，再执行：",
                shellBlock([
                    `MODEL_ID=${shellToken("kimi-k3")}`,
                    `${platformEnvironment} evalhub run ${shellToken(definition.id)} --model "$MODEL_ID" --out ${shellToken(output)}`,
                ].join("\n")),
            ].join("\n\n");
    const submission = resolveScorePolicy(definition) === "author_fill"
        ? "用户在网页确认发布后，本评测允许作者补分：结果自带 score 时，出现 awaiting author approval 是正常状态；score=null 时会 awaiting grading，完成判分前不会公开。"
        : "本评测要求结果自带数值 score；score=null 会在提交校验时直接失败。用户确认发布后，成绩仍须经评测作者认可才会计入公开排行榜。";
    const title = singleLineHeading(definition.name);
    const prerequisites = taskId === null
        ? [
            `1. 安装或更新到 npm 当前发布的最新版 CLI：\n\n${shellBlock(`npm install -g ${shellToken(cliPackageSpec)}`)}`,
            "2. 下载和本地运行不需要创建提交任务；只有用户决定正式提交成绩时才领取任务卡。",
        ].join("\n\n")
        : [
            `1. 安装或更新到 npm 当前发布的最新版 CLI：\n\n${shellBlock(`npm install -g ${shellToken(cliPackageSpec)}`)}`,
            pairingCode === null
                ? `2. 按用户任务卡上的连接命令连接本次任务（平台地址 ${origin}）。`
                : `2. 连接本次任务：\n\n${shellBlock(`evalhub connect ${shellToken(pairingCode)} --platform-url ${shellToken(origin)}`)}`,
            `3. connect 成功后，把上面的任务页链接发给用户，请用户本人打开并授权这台设备：\n\n${taskUrl}`,
            "你不得代替用户点击授权或确认公开，也不得把连接命令、任务链接以外的任务信息写进日志或评测产物。用户告知授权完成后再继续。",
        ].join("\n\n");
    const reviewInstruction = taskUrl === null
        ? "成功只表示成绩草稿已上传，并不表示已经公开。把命令返回的任务页链接发给用户，请用户本人打开网页核对并点击确认公开。"
        : `成功只表示成绩草稿已上传，并不表示已经公开。上传成功后，再把同一个任务页链接发给用户一次，请用户本人打开网页核对并点击确认公开：\n\n${taskUrl}`;
    const submissionInstructions = taskId === null
        ? `评测执行完成后先停下。只有用户决定正式提交时，才请用户本人打开下面页面并点击「提交成绩」领取任务卡：\n\n${startUrl}\n\n领取后使用新任务卡里的连接命令和提交步骤；不要把评测产物或未确认草稿当成提交进度。`
        : `运行：\n\n${shellBlock(`evalhub submit ${shellToken(output)} --platform-url ${shellToken(origin)}`)}\n\n${reviewInstruction} Agent 不得代点确认、不得声称草稿已经公开，也不要因为等待网页确认或作者判分而重复提交。`;
    return `---
schema: evalhub-brief/v1
eval: ${yamlScalar(definition.id)}
name: ${yamlScalar(definition.name)}
interface: ${yamlScalar(definition.interface)}
scored_by: ${yamlScalar(definition.scored_by)}
score_policy: ${yamlScalar(resolveScorePolicy(definition))}
score_unit: ${yamlScalar(definition.score_unit)}
est_tokens: ${definition.est_tokens ?? "null"}
submit_format: result-v1
brief_url: ${yamlScalar(briefUrl)}
detail_url: ${yamlScalar(detailUrl)}
---

# ${title} · Agent 任务卡

## 0. 你需要向用户确认的事

确认要使用的模型 ID（例如 \`kimi-k3\` 或 \`vendor/model-name\`）。${cost}

## 1. 前置

${prerequisites}

## 2. 执行

${execution}

## 3. 产物自检

运行：

${shellBlock(`evalhub validate ${shellToken(output)}`)}

该命令成功只表示结构与评测契约检查通过，未验证证据来源/模型身份/成绩真实性。

不得编造分数或伪造输出；结果接受作者判断与社区复核，违规提交可能被拒绝或封禁。

## 4. 提交与预期

${submissionInstructions}

${submission}
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
function cliPackageSpecValue(raw) {
    const value = raw.trim();
    if (value !== CLI_PACKAGE_SPEC) {
        throw new Error("cliPackageSpec must be exactly @evalhub/cli");
    }
    return value;
}
function opaqueTaskId(raw) {
    const value = raw.trim();
    if (!OPAQUE_TASK_ID.test(value)) {
        throw new Error("taskId must be an opaque submission task id");
    }
    return value;
}
function platformPairingCode(raw) {
    const value = raw.trim().toUpperCase();
    if (!PAIRING_CODE.test(value)) {
        throw new Error("pairingCode must be a platform pairing code");
    }
    return value;
}
function shellToken(token) {
    return /^[A-Za-z0-9_./:@%+=,-]+$/u.test(token)
        ? token
        : `'${token.replace(/'/gu, `'\\''`)}'`;
}
function shellBlock(command) {
    let fence = "```";
    while (command.includes(fence)) {
        fence += "`";
    }
    return `${fence}sh\n${command}\n${fence}`;
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
