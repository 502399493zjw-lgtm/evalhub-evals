export { CommandInputOverrideSchema, CommandOutputOverrideSchema, CommandTemplateSchema, CustomRunnerModeSchema, EvalIdSchema, EvalDefSchema, EvalDetailProfileSchema, EvalReferencesSchema, EvalTaskMediaSchema, EvalTiebreakSchema, MAX_TASK_MEDIA_ITEMS, resolveScorePolicy, resolveCustomRunnerMode, StoredEvalDefSchema, UpstreamSourceSchema, } from "./eval-def.js";
export type { CommandTemplate, CustomRunnerMode, EvalDef, EvalDetailProfile, LegacyEvalDetailProfile, MarkdownOnlyDetailProfile, EvalReferences, EvalTaskMedia, EvalTiebreak, StoredEvalDef, UpstreamSource, } from "./eval-def.js";
export { EVAL_AUTHORS_HANDLE_PATTERN, EVAL_AUTHORS_PLACEHOLDER, EVAL_MAINTAINER_HANDLE_PATTERN, EVAL_MAINTAINER_PLACEHOLDER, parseEvalAuthorsText, parseEvalMaintainerText, } from "./authors.js";
export type { EvalAuthorsParseErrorCode, EvalAuthorsParseResult, EvalMaintainerParseErrorCode, EvalMaintainerParseResult, } from "./authors.js";
export { githubOwnerFromRepositoryIdentity, githubOwnerFromRepositoryUrl, resolveEvalSourceOwnerHandle, } from "./source-owner.js";
export type { EvalSourceOwnerInput } from "./source-owner.js";
export { buildAgentBrief } from "./agent-brief.js";
export type { AgentBriefOptions } from "./agent-brief.js";
export { buildRunEvalBrief, RunEvalBriefInputError } from "./run-eval-brief.js";
export type { RunEvalBriefInputErrorCode, RunEvalBriefOptions, } from "./run-eval-brief.js";
export { HEAD_TO_HEAD_MAX_GAMES_PER_MATCHUP, ParticipantAdapterSchema, ParticipantConfigSchema, ParticipantModelSchema, RESULT_ENTRY_MAX_SHOWCASES, RESULT_ENTRY_MAX_SUPPLEMENTARY_VIEWS, RESULT_ENTRY_MAX_TASK_RESULTS, RESULT_FILE_MAX_RESULTS, SHOWCASE_TASK_ID_MAX_LENGTH, HeadToHeadShowcaseSchema, TeamGamesShowcaseSchema, ResultEntrySchema, ResultFileSchema, ResultSubmissionSchema, RunSubmissionSchema, isUpstreamAuthorPublicationSubmission, ShowcaseSchema, SupplementaryViewSchema, UpstreamAuthorPublicationSubmissionSchema, } from "./result.js";
export type { HeadToHeadMatchup, HeadToHeadParticipant, HeadToHeadShowcase, LineChartView, MetricTableView, TeamGamesShowcase, ResultEntry, ResultFile, ResultSubmission, RunSubmission, Showcase, SupplementaryView, UpstreamAuthorPublicationSubmission, } from "./result.js";
export { DatedModelIdSchema, ModelIdSchema, validateParticipantForEval, } from "./participant-for-eval.js";
export type { ResultValidationContext, ResultValidationOrigin, } from "./participant-for-eval.js";
export { validateResultForEval } from "./result-for-eval.js";
export { hasChineseText, validateEvalReaderCopy, validateReaderCopy, } from "./reader-copy.js";
export type { EvalReaderCopyIssue, EvalReaderCopyIssueCode, EvalReaderCopyValidationOptions, EvalReaderCopyValidationResult, ReaderCopyField, ReaderCopyIssue, ReaderCopyIssueCode, ReaderCopyValidationOptions, ReaderCopyValidationResult, } from "./reader-copy.js";
export { buildEvalCommandPlan, buildResultAdapterPlan } from "./command-plan.js";
export type { AvailableEvalCommandPlan, EvalCommandDefinition, EvalCommandPlan, EvalCommandPlanOptions, ResultAdapterPlan, ResultAdapterPlanOptions, UnavailableEvalCommandPlan, } from "./command-plan.js";
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
