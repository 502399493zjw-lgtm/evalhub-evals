import { z } from "zod";
import { ParticipantHarnessSchema, ParticipantHarnessVersionSchema, ParticipantModelSchema, } from "./result.js";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const MODEL_ID_CHARACTERS = /^[A-Za-z0-9._/:+-]+$/u;
const MAX_MODEL_ID_LENGTH = 255;
export const ModelIdSchema = z.string().superRefine((value, ctx) => {
    if (value.length < 1) {
        ctx.addIssue({ code: "custom", message: "participant.model must not be empty" });
    }
    if (value !== value.trim()) {
        ctx.addIssue({
            code: "custom",
            message: "participant.model must be already trimmed",
        });
    }
    if (value.length > MAX_MODEL_ID_LENGTH) {
        ctx.addIssue({
            code: "custom",
            message: `participant.model must be at most ${MAX_MODEL_ID_LENGTH} characters`,
        });
    }
    if (CONTROL_CHARACTERS.test(value)) {
        ctx.addIssue({
            code: "custom",
            message: "participant.model must not contain control characters",
        });
    }
    if (!MODEL_ID_CHARACTERS.test(value)) {
        ctx.addIssue({
            code: "custom",
            message: "participant.model may only contain ASCII letters, numbers, and ._/:+-",
        });
    }
});
/** @deprecated Use ModelIdSchema. Dates are not required in model IDs. */
export const DatedModelIdSchema = ModelIdSchema;
function customIssue(path, message) {
    return { code: "custom", path, message };
}
export function validateParticipantForEval(context, participant, origin = "run") {
    const issues = [];
    const modelValidation = origin === "upstream_author_publication"
        ? ParticipantModelSchema.safeParse(participant.model)
        : ModelIdSchema.safeParse(participant.model);
    if (!modelValidation.success) {
        for (const issue of modelValidation.error.issues) {
            issues.push(customIssue(["model", ...issue.path], issue.message));
        }
    }
    if (participant.harness !== undefined) {
        const harnessValidation = ParticipantHarnessSchema.safeParse(participant.harness);
        if (!harnessValidation.success) {
            for (const issue of harnessValidation.error.issues) {
                issues.push(customIssue(["harness", ...issue.path], issue.message));
            }
        }
    }
    if (participant.harness_version !== undefined) {
        const harnessVersionValidation = ParticipantHarnessVersionSchema.safeParse(participant.harness_version);
        if (!harnessVersionValidation.success) {
            for (const issue of harnessVersionValidation.error.issues) {
                issues.push(customIssue(["harness_version", ...issue.path], issue.message));
            }
        }
    }
    if (origin === "upstream_author_publication") {
        if (participant.config !== undefined) {
            issues.push(customIssue(["config"], "upstream_author_publication participants cannot include config"));
        }
        if (participant.harness_version !== undefined &&
            participant.harness === undefined) {
            issues.push(customIssue(["harness"], "upstream harness_version requires harness"));
        }
        if (issues.length > 0) {
            return { success: false, error: new z.ZodError(issues) };
        }
        return { success: true, data: participant };
    }
    if (context.interface === "chat") {
        if (participant.harness !== undefined) {
            issues.push(customIssue(["harness"], `interface=${context.interface} participants cannot include harness`));
        }
        if (participant.harness_version !== undefined) {
            issues.push(customIssue(["harness_version"], `interface=${context.interface} participants cannot include harness_version`));
        }
    }
    else {
        if (participant.harness !== undefined &&
            participant.harness_version === undefined) {
            issues.push(customIssue(["harness_version"], "填了 harness 必带 harness_version"));
        }
        if (participant.harness_version !== undefined &&
            participant.harness === undefined) {
            issues.push(customIssue(["harness"], "填了 harness_version 必带 harness"));
        }
    }
    if (issues.length > 0) {
        return { success: false, error: new z.ZodError(issues) };
    }
    return { success: true, data: participant };
}
