import type { EvalDef, StoredEvalDef } from "./eval-def.js";
export type AgentBriefOptions = {
    siteOrigin: string;
    cliPackageSpec: string;
    /** @deprecated Legacy submission context; ignored by buildAgentBrief. */
    taskId?: string | undefined;
    /** @deprecated Legacy submission context; ignored by buildAgentBrief. */
    pairingCode?: string | undefined;
};
/**
 * Legacy-compatible entry point for Agent briefs.
 *
 * Run instructions are available only when the eval points at a public,
 * precisely pinned GitHub upstream. Older task and pairing arguments remain
 * accepted for callers that still pass them, but are intentionally ignored.
 */
export declare function buildAgentBrief(definition: StoredEvalDef | EvalDef, options: AgentBriefOptions): string;
