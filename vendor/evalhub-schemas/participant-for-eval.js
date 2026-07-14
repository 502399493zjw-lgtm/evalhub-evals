import { z } from "zod";
import { ParticipantHarnessSchema, ParticipantHarnessVersionSchema, } from "./result.js";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const MODEL_ID_CHARACTERS = /^[A-Za-z0-9._/:+-]+$/u;
const MAX_MODEL_ID_LENGTH = 255;
const DATED_MODEL_ID_MESSAGE = "participant.model must have a non-empty prefix and end with a real YYYYMMDD or YYYY-MM-DD date";
function parseDatedModelId(value) {
    const dashed = /^(.*)(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
    const compact = /^(.*)(\d{4})(\d{2})(\d{2})$/u.exec(value);
    const match = dashed ?? compact;
    if (!match) {
        return null;
    }
    return {
        prefix: match[1] ?? "",
        year: Number(match[2]),
        month: Number(match[3]),
        day: Number(match[4]),
    };
}
function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
function isRealGregorianDate({ year, month, day }) {
    if (year < 1 || month < 1 || month > 12 || day < 1) {
        return false;
    }
    const daysInMonth = [
        31,
        isLeapYear(year) ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    return day <= (daysInMonth[month - 1] ?? 0);
}
export const DatedModelIdSchema = z.string().superRefine((value, ctx) => {
    let canCheckDate = true;
    if (value !== value.trim()) {
        ctx.addIssue({
            code: "custom",
            message: "participant.model must be already trimmed",
        });
        canCheckDate = false;
    }
    if (value.length > MAX_MODEL_ID_LENGTH) {
        ctx.addIssue({
            code: "custom",
            message: `participant.model must be at most ${MAX_MODEL_ID_LENGTH} characters`,
        });
        canCheckDate = false;
    }
    if (CONTROL_CHARACTERS.test(value)) {
        ctx.addIssue({
            code: "custom",
            message: "participant.model must not contain control characters",
        });
        canCheckDate = false;
    }
    if (!MODEL_ID_CHARACTERS.test(value)) {
        ctx.addIssue({
            code: "custom",
            message: "participant.model may only contain ASCII letters, numbers, and ._/:+-",
        });
        canCheckDate = false;
    }
    if (!canCheckDate) {
        return;
    }
    const datedModelId = parseDatedModelId(value);
    if (datedModelId === null ||
        datedModelId.prefix.length === 0 ||
        !isRealGregorianDate(datedModelId)) {
        ctx.addIssue({ code: "custom", message: DATED_MODEL_ID_MESSAGE });
    }
});
function customIssue(path, message) {
    return { code: "custom", path, message };
}
export function validateParticipantForEval(context, participant) {
    const issues = [];
    const modelValidation = DatedModelIdSchema.safeParse(participant.model);
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
    if (context.interface !== "agent") {
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
