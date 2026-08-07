export { CommandInputOverrideSchema, CommandOutputOverrideSchema, CommandTemplateSchema, CustomRunnerModeSchema, EvalIdSchema, EvalDefSchema, EvalDetailProfileSchema, EvalReferencesSchema, EvalTiebreakSchema, resolveScorePolicy, resolveCustomRunnerMode, StoredEvalDefSchema, UpstreamSourceSchema, } from "./eval-def.js";
export type { CommandTemplate, CustomRunnerMode, EvalDef, EvalDetailProfile, EvalReferences, EvalTiebreak, StoredEvalDef, UpstreamSource, } from "./eval-def.js";
export { buildAgentBrief } from "./agent-brief.js";
export type { AgentBriefOptions } from "./agent-brief.js";
export { HEAD_TO_HEAD_MAX_GAMES_PER_MATCHUP, ParticipantAdapterSchema, ParticipantConfigSchema, ParticipantModelSchema, RESULT_ENTRY_MAX_SHOWCASES, RESULT_ENTRY_MAX_SUPPLEMENTARY_VIEWS, RESULT_ENTRY_MAX_TASK_RESULTS, RESULT_FILE_MAX_RESULTS, SHOWCASE_TASK_ID_MAX_LENGTH, HeadToHeadShowcaseSchema, TeamGamesShowcaseSchema, ResultEntrySchema, ResultFileSchema, ResultSubmissionSchema, RunSubmissionSchema, ShowcaseSchema, SupplementaryViewSchema, UpstreamAuthorPublicationSubmissionSchema, } from "./result.js";
export type { HeadToHeadMatchup, HeadToHeadParticipant, HeadToHeadShowcase, LineChartView, MetricTableView, TeamGamesShowcase, ResultEntry, ResultFile, ResultSubmission, RunSubmission, Showcase, SupplementaryView, UpstreamAuthorPublicationSubmission, } from "./result.js";
export { DatedModelIdSchema, ModelIdSchema, validateParticipantForEval, } from "./participant-for-eval.js";
export type { ResultValidationContext, ResultValidationOrigin, } from "./participant-for-eval.js";
export { validateResultForEval } from "./result-for-eval.js";
export { buildEvalCommandPlan } from "./command-plan.js";
export type { AvailableEvalCommandPlan, EvalCommandDefinition, EvalCommandPlan, EvalCommandPlanOptions, UnavailableEvalCommandPlan, } from "./command-plan.js";
export declare const F1_POINTS: readonly [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export declare const MIN_VERIFIED_FOR_POINTS = 2;
export declare const MAX_INT4_ID = 2147483647;
export declare function isPositiveInt4Id(value: number): boolean;
export declare function parsePositiveInt4Id(value: string): number | null;
export type ParticipantKeyOrigin = {
    kind?: "run" | undefined;
} | {
    kind: "upstream_author_publication";
    source: {
        url: string;
    };
};
export declare function participantKey(participant: {
    model: string;
    harness?: string | undefined;
    harness_version?: string | undefined;
}, origin?: ParticipantKeyOrigin): string;
