const EXACT_CLI_PACKAGE_SPEC = /^@evalhub\/cli@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const OPAQUE_TASK_ID = /^task_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PAIRING_CODE = /^[0-9A-HJ-NP-TV-Z]{4}(?:-[0-9A-HJ-NP-TV-Z]{4}){4}$/u;
export function buildAgentBrief(definition, options) {
    const origin = siteOrigin(options.siteOrigin);
    const cliPackageSpec = exactCliPackageSpec(options.cliPackageSpec);
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
    const execution = definition.runner === "custom"
        ? [
            `这是自定义 runner。详情页：${detailUrl}`,
            `先让 CLI 下载平台钉死的源码 commit，但不执行：\n\n${shellBlock(`${platformEnvironment} evalhub run ${shellToken(definition.id)} --out ${shellToken(output)}`)}`,
            "runner 及其依赖是不受平台信任的第三方代码。检查 CLI 打印的本地源码目录、commit、README、依赖、权限、网络访问和环境变量使用；把执行计划与命令给用户看，得到用户明确确认后才执行。如果固定源码链接或 commit 缺失、无法核对，就停下询问。",
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
    const submission = definition.scored_by === "author"
        ? "用户在网页确认发布后，本评测由作者判分：结果自带 score 时，出现 awaiting author approval 是正常状态；score=null 时会 awaiting grading，完成判分前不会公开。"
        : "用户在网页确认发布后，结果仍须经评测作者认可才会计入公开排行榜；未认可的结果不计榜。";
    const title = singleLineHeading(definition.name);
    const prerequisites = taskId === null
        ? [
            `1. 安装平台指定的精确 CLI 版本：\n\n${shellBlock(`npm install -g ${shellToken(cliPackageSpec)}`)}`,
            "2. 下载和本地运行不需要创建提交任务；只有用户决定正式提交成绩时才领取任务卡。",
        ].join("\n\n")
        : [
            `1. 安装平台指定的精确 CLI 版本：\n\n${shellBlock(`npm install -g ${shellToken(cliPackageSpec)}`)}`,
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
        ? `本地运行完成后先停下。只有用户决定正式提交时，才请用户本人打开下面页面并点击「提交成绩」领取任务卡：\n\n${startUrl}\n\n领取后使用新任务卡里的连接命令和提交步骤；不要把本地运行或未确认草稿当成提交进度。`
        : `运行：\n\n${shellBlock(`evalhub submit ${shellToken(output)} --platform-url ${shellToken(origin)}`)}\n\n${reviewInstruction} Agent 不得代点确认、不得声称草稿已经公开，也不要因为等待网页确认或作者判分而重复提交。`;
    return `---
schema: evalhub-brief/v1
eval: ${yamlScalar(definition.id)}
name: ${yamlScalar(definition.name)}
interface: ${yamlScalar(definition.interface)}
scored_by: ${yamlScalar(definition.scored_by)}
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
function exactCliPackageSpec(raw) {
    const value = raw.trim();
    if (!EXACT_CLI_PACKAGE_SPEC.test(value)) {
        throw new Error("cliPackageSpec must be an exact @evalhub/cli@x.y.z version");
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
