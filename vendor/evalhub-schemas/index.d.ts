export { CommandOutputOverrideSchema, CommandTemplateSchema, EvalIdSchema, EvalDefSchema, StoredEvalDefSchema, } from "./eval-def.js";
export type { CommandTemplate, EvalDef, StoredEvalDef, } from "./eval-def.js";
export { HEAD_TO_HEAD_MAX_GAMES_PER_MATCHUP, ParticipantAdapterSchema, ParticipantConfigSchema, RESULT_ENTRY_MAX_SHOWCASES, RESULT_ENTRY_MAX_TASK_RESULTS, RESULT_FILE_MAX_RESULTS, HeadToHeadShowcaseSchema, ResultEntrySchema, ResultFileSchema, ShowcaseSchema, } from "./result.js";
export type { HeadToHeadMatchup, HeadToHeadParticipant, HeadToHeadShowcase, ResultEntry, ResultFile, Showcase, } from "./result.js";
export { DatedModelIdSchema, validateParticipantForEval, } from "./participant-for-eval.js";
export type { ResultValidationContext } from "./participant-for-eval.js";
export { validateResultForEval } from "./result-for-eval.js";
export { buildEvalCommandPlan } from "./command-plan.js";
export type { AvailableEvalCommandPlan, EvalCommandDefinition, EvalCommandPlan, EvalCommandPlanOptions, UnavailableEvalCommandPlan, } from "./command-plan.js";
export declare const F1_POINTS: readonly [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export declare const MIN_VERIFIED_FOR_POINTS = 4;
export declare const MAX_INT4_ID = 2147483647;
export declare function isPositiveInt4Id(value: number): boolean;
export declare function parsePositiveInt4Id(value: string): number | null;
export declare function participantKey(p: {
    model: string;
    harness?: string;
}): string;
