export { CommandInputOverrideSchema, CommandOutputOverrideSchema, CommandTemplateSchema, CustomRunnerModeSchema, EvalIdSchema, EvalDefSchema, EvalDetailProfileSchema, EvalReferencesSchema, EvalTaskMediaSchema, EvalTiebreakSchema, MAX_TASK_MEDIA_ITEMS, resolveScorePolicy, resolveCustomRunnerMode, StoredEvalDefSchema, UpstreamSourceSchema, } from "./eval-def.js";
export { EVAL_AUTHORS_HANDLE_PATTERN, EVAL_AUTHORS_PLACEHOLDER, parseEvalAuthorsText, } from "./authors.js";
export { buildAgentBrief } from "./agent-brief.js";
export { buildRunEvalBrief, RunEvalBriefInputError } from "./run-eval-brief.js";
export { HEAD_TO_HEAD_MAX_GAMES_PER_MATCHUP, ParticipantAdapterSchema, ParticipantConfigSchema, ParticipantModelSchema, RESULT_ENTRY_MAX_SHOWCASES, RESULT_ENTRY_MAX_SUPPLEMENTARY_VIEWS, RESULT_ENTRY_MAX_TASK_RESULTS, RESULT_FILE_MAX_RESULTS, SHOWCASE_TASK_ID_MAX_LENGTH, HeadToHeadShowcaseSchema, TeamGamesShowcaseSchema, ResultEntrySchema, ResultFileSchema, ResultSubmissionSchema, RunSubmissionSchema, isUpstreamAuthorPublicationSubmission, ShowcaseSchema, SupplementaryViewSchema, UpstreamAuthorPublicationSubmissionSchema, } from "./result.js";
export { DatedModelIdSchema, ModelIdSchema, validateParticipantForEval, } from "./participant-for-eval.js";
export { validateResultForEval } from "./result-for-eval.js";
export { hasChineseText, validateEvalReaderCopy, validateReaderCopy, } from "./reader-copy.js";
export { buildEvalCommandPlan, buildResultAdapterPlan } from "./command-plan.js";
export const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
// 计分生效门槛（owner 调整 2026-07-19）：4→2——两人成局即有名次可比；
// 早期生态 4 人门槛导致全站零积分（总榜空）。防刷分靠作者认可 + 并列平分，不靠人数门槛。
export const MIN_VERIFIED_FOR_POINTS = 2;
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
export function participantKey(participant, origin = {}) {
    if (origin.kind === "upstream_author_publication") {
        return JSON.stringify([
            "upstream_author_publication",
            origin.source.url,
            participant.model,
            participant.harness ?? null,
            participant.harness_version ?? null,
        ]);
    }
    return JSON.stringify([
        "run",
        participant.model,
        participant.harness ?? null,
        participant.harness_version ?? null,
    ]);
}
