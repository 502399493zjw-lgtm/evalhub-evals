import { z } from "zod";
import { type ResultEntry } from "./result.js";
export declare const DatedModelIdSchema: z.ZodEffects<z.ZodString, string, string>;
export type ResultValidationContext = {
    id: string;
    interface: "chat" | "dialogue" | "agent";
    scored_by: "local" | "author";
};
type ResultParticipant = ResultEntry["participant"];
export declare function validateParticipantForEval(context: ResultValidationContext, participant: ResultParticipant): z.SafeParseReturnType<ResultParticipant, ResultParticipant>;
export {};
