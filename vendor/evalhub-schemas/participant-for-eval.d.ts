import { z } from "zod";
import { type ResultEntry } from "./result.js";
export declare const ModelIdSchema: z.ZodEffects<z.ZodString, string, string>;
/** @deprecated Use ModelIdSchema. Dates are not required in model IDs. */
export declare const DatedModelIdSchema: z.ZodEffects<z.ZodString, string, string>;
export type ResultValidationContext = {
    id: string;
    interface: "chat" | "dialogue" | "agent";
    scored_by: "local" | "author";
    score_policy?: "required" | "author_fill" | undefined;
    /** 评测集量纲（2026-07-20）：缺省视为「分」（0-100 契约）；非「分」放开 100 上限 */
    score_unit?: string;
    leaderboard?: "latest_session" | "rating";
    trials?: number;
};
export type ResultValidationOrigin = "run" | "upstream_author_publication";
type ResultParticipant = ResultEntry["participant"];
export declare function validateParticipantForEval(context: ResultValidationContext, participant: ResultParticipant, origin?: ResultValidationOrigin): z.SafeParseReturnType<ResultParticipant, ResultParticipant>;
export {};
