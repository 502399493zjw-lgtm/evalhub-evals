import { type EvalDef, type StoredEvalDef } from "./eval-def.js";
export type AgentBriefOptions = {
    siteOrigin: string;
    cliPackageSpec: string;
    taskId?: string | undefined;
    pairingCode?: string | undefined;
};
export declare function buildAgentBrief(definition: StoredEvalDef | EvalDef, options: AgentBriefOptions): string;
