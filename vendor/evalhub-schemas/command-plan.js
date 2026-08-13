import { CommandInputOverrideSchema, CommandOutputOverrideSchema, CommandOutputSchema, resolveCustomRunnerMode, } from "./eval-def.js";
const POSIX_SAFE_ARGUMENT = /^[A-Za-z0-9_@%+=:,./-]+$/;
function quoteShellArgument(argument) {
    if (POSIX_SAFE_ARGUMENT.test(argument)) {
        return argument;
    }
    return `'${argument.replaceAll("'", "'\\''")}'`;
}
function renderShellArgv(argv) {
    return argv.map(quoteShellArgument).join(" ");
}
function availablePlan(runArgv, output) {
    const submitArgv = ["evalhub", "submit", output];
    return {
        available: true,
        runArgv,
        submitArgv,
        output,
        shellCommand: `${renderShellArgv(runArgv)} && ${renderShellArgv(submitArgv)}`,
    };
}
function resolveOutput(defaultOutput, override) {
    return override === undefined
        ? CommandOutputSchema.parse(defaultOutput)
        : CommandOutputOverrideSchema.parse(override);
}
export function buildResultAdapterPlan(commandTemplate, options) {
    const input = CommandInputOverrideSchema.parse(options.input);
    const output = resolveOutput(commandTemplate.output, options.output);
    return {
        argv: commandTemplate.argv.map((argument) => argument === "{input}"
            ? input
            : argument === "{output}"
                ? output
                : argument),
        input,
        output,
    };
}
/**
 * @deprecated Platform/history compatibility only.
 *
 * This renderer still describes the historical run/submit lifecycle for
 * callers that have not migrated. The CLI must not execute this plan; use
 * `buildResultAdapterPlan` for source-first `evalhub pack`.
 */
export function buildEvalCommandPlan(evalDef, options = {}) {
    if (evalDef.runner === "custom") {
        if (!evalDef.command_template) {
            return {
                available: false,
                reason: "custom_runner_command_unavailable",
            };
        }
        const mode = resolveCustomRunnerMode(evalDef);
        if (mode === "external_workflow" && options.input === undefined) {
            return {
                available: false,
                reason: "custom_runner_input_required",
            };
        }
        const output = resolveOutput(evalDef.command_template.output, options.output);
        const input = options.input === undefined
            ? undefined
            : CommandInputOverrideSchema.parse(options.input);
        const runArgv = evalDef.command_template.argv.map((argument) => argument === "{output}"
            ? output
            : argument === "{input}" && input !== undefined
                ? input
                : argument);
        return availablePlan(runArgv, output);
    }
    const output = resolveOutput(`${evalDef.id}-result.json`, options.output);
    const runArgv = ["evalhub", "run", evalDef.id];
    if (options.model !== undefined) {
        runArgv.push("--model", options.model);
    }
    if (options.adapter !== undefined) {
        runArgv.push("--adapter", options.adapter);
    }
    if (evalDef.interface === "agent" &&
        options.harness !== undefined &&
        options.harnessVersion !== undefined) {
        runArgv.push("--harness", options.harness, "--harness-version", options.harnessVersion);
    }
    runArgv.push("--out", output);
    return availablePlan(runArgv, output);
}
