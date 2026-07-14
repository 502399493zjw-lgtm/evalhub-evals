import { z } from "zod";
import { validateParticipantForEval, } from "./participant-for-eval.js";
function customIssue(path, message) {
    return {
        code: "custom",
        path,
        message,
    };
}
export function validateResultForEval(context, resultFile) {
    const issues = [];
    if (resultFile.eval_id !== context.id) {
        issues.push(customIssue(["eval_id"], `result eval_id must match eval.id "${context.id}"`));
    }
    if ((context.interface === "chat" || context.interface === "agent") &&
        resultFile.results.length !== 1) {
        issues.push(customIssue(["results"], `interface=${context.interface} requires exactly one result`));
    }
    if (context.interface === "dialogue" && resultFile.results.length < 2) {
        issues.push(customIssue(["results"], "interface=dialogue requires at least two results"));
    }
    const dialogueParticipants = new Set();
    const envelopeParticipants = new Set(resultFile.results.map((result) => result.participant.model));
    for (const [index, result] of resultFile.results.entries()) {
        const participantPath = ["results", index, "participant"];
        const participantValidation = validateParticipantForEval(context, result.participant);
        if (!participantValidation.success) {
            for (const issue of participantValidation.error.issues) {
                issues.push(customIssue([...participantPath, ...issue.path], issue.message));
            }
        }
        if (context.interface === "dialogue") {
            if (dialogueParticipants.has(result.participant.model)) {
                issues.push(customIssue([...participantPath, "model"], "dialogue participant identities must be unique"));
            }
            else {
                dialogueParticipants.add(result.participant.model);
            }
        }
        if (context.scored_by === "local" && result.score === null) {
            issues.push(customIssue(["results", index, "score"], "scored_by=local requires a non-null score"));
        }
        if (context.scored_by === "author" && result.score !== null) {
            issues.push(customIssue(["results", index, "score"], "scored_by=author requires a null score before author review"));
        }
        for (const [showcaseIndex, showcase] of (result.showcases ?? []).entries()) {
            if (showcase.type !== "head_to_head") {
                continue;
            }
            const showcasePath = ["results", index, "showcases", showcaseIndex];
            if (context.interface !== "dialogue") {
                issues.push(customIssue([...showcasePath, "type"], "head_to_head showcases require interface=dialogue"));
                continue;
            }
            for (const [participantIndex, participant] of showcase.participants.entries()) {
                if (!envelopeParticipants.has(participant.key)) {
                    issues.push(customIssue([...showcasePath, "participants", participantIndex, "key"], "head_to_head participant must occur in the same dialogue envelope"));
                }
            }
        }
    }
    if (issues.length > 0) {
        return { success: false, error: new z.ZodError(issues) };
    }
    return { success: true, data: resultFile };
}
