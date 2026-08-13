import { z } from "zod";
import { type ResultValidationContext } from "./participant-for-eval.js";
import { type ResultFile } from "./result.js";
export declare function validateResultForEval(context: ResultValidationContext, resultFile: ResultFile, options?: {
    requireOfficialResultCount?: boolean;
}): z.SafeParseReturnType<ResultFile, ResultFile>;
