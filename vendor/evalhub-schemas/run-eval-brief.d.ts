import type { EvalDef, StoredEvalDef } from "./eval-def.js";
export type RunEvalBriefOptions = {
    siteOrigin: string;
    cliPackageSpec: string;
};
export type RunEvalBriefInputErrorCode = "missing_upstream" | "incomplete_upstream_commit";
export declare class RunEvalBriefInputError extends Error {
    readonly code: RunEvalBriefInputErrorCode;
    constructor(code: RunEvalBriefInputErrorCode, message: string);
}
/**
 * Builds the public, run-only Agent brief for a benchmark hosted in a pinned
 * upstream GitHub repository. This workflow deliberately stops after local
 * result validation and never enters the score-submission lifecycle.
 */
export declare function buildRunEvalBrief(definition: StoredEvalDef | EvalDef, options: RunEvalBriefOptions): string;
