import { type CommandTemplate } from "./eval-def.js";
export type EvalCommandDefinition = {
    id: string;
    interface: "chat" | "dialogue" | "agent";
    runner: "builtin" | "custom";
    command_template?: CommandTemplate | null | undefined;
};
export type EvalCommandPlanOptions = {
    output?: string | undefined;
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
    reason: "custom_runner_command_unavailable";
};
export type EvalCommandPlan = AvailableEvalCommandPlan | UnavailableEvalCommandPlan;
export declare function buildEvalCommandPlan(evalDef: EvalCommandDefinition, options?: EvalCommandPlanOptions): EvalCommandPlan;
