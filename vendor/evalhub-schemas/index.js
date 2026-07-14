export { CommandOutputOverrideSchema, CommandTemplateSchema, EvalIdSchema, EvalDefSchema, StoredEvalDefSchema, } from "./eval-def.js";
export { HEAD_TO_HEAD_MAX_GAMES_PER_MATCHUP, ParticipantAdapterSchema, ParticipantConfigSchema, RESULT_ENTRY_MAX_SHOWCASES, RESULT_ENTRY_MAX_TASK_RESULTS, RESULT_FILE_MAX_RESULTS, HeadToHeadShowcaseSchema, ResultEntrySchema, ResultFileSchema, ShowcaseSchema, } from "./result.js";
export { DatedModelIdSchema, validateParticipantForEval, } from "./participant-for-eval.js";
export { validateResultForEval } from "./result-for-eval.js";
export { buildEvalCommandPlan } from "./command-plan.js";
export const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const MIN_VERIFIED_FOR_POINTS = 4;
export const MAX_INT4_ID = 2_147_483_647;
export function isPositiveInt4Id(value) {
    return Number.isInteger(value) && value > 0 && value <= MAX_INT4_ID;
}
export function parsePositiveInt4Id(value) {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }
    const parsed = Number(value);
    return isPositiveInt4Id(parsed) ? parsed : null;
}
export function participantKey(p) {
    return JSON.stringify([p.model, p.harness ?? null]);
}
