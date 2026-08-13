import { type CommandTemplate, type CustomRunnerMode } from "./eval-def.js";
export type EvalCommandDefinition = {
    id: string;
    interface: "chat" | "dialogue" | "agent";
    runner: "builtin" | "custom";
    custom_mode?: CustomRunnerMode | undefined;
    command_template?: CommandTemplate | null | undefined;
};
export type EvalCommandPlanOptions = {
    output?: string | undefined;
    input?: string | undefined;
    model?: string | undefined;
    adapter?: "api" | "command" | undefined;
    harness?: string | undefined;
    harnessVersion?: string | undefined;
};
export type AvailableEvalCommandPlan = {
    available: true;
    runArgv: string[];
    submitArgv: string[];
    output: string;
    /** Display/copy text rendered with POSIX shell quoting; never auto-executed. */
    shellCommand: string;
};
export type UnavailableEvalCommandPlan = {
    available: false;
    reason: "custom_runner_command_unavailable" | "custom_runner_input_required";
};
export type EvalCommandPlan = AvailableEvalCommandPlan | UnavailableEvalCommandPlan;
/**
 * The only command EvalHub is allowed to execute in the source-first workflow:
 * a declared result adapter over a real upstream result.
 *
 * This intentionally has no `submitArgv` or rendered shell pipeline. The
 * broader `EvalCommandPlan` below remains exported for platform/history
 * compatibility while its builtin `evalhub run` shape is migrated away.
 */
export type ResultAdapterPlanOptions = {
    input: string;
    output?: string | undefined;
};
export type ResultAdapterPlan = {
    argv: string[];
    input: string;
    output: string;
};
export declare function buildResultAdapterPlan(commandTemplate: CommandTemplate, options: ResultAdapterPlanOptions): ResultAdapterPlan;
/**
 * @deprecated Platform/history compatibility only.
 *
 * This renderer still describes the historical run/submit lifecycle for
 * callers that have not migrated. The CLI must not execute this plan; use
 * `buildResultAdapterPlan` for source-first `evalhub pack`.
 */
export declare function buildEvalCommandPlan(evalDef: EvalCommandDefinition, options?: EvalCommandPlanOptions): EvalCommandPlan;
