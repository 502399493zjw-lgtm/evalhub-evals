import { z } from "zod";
import { validateParticipantForEval, } from "./participant-for-eval.js";
function customIssue(path, message) {
    return {
        code: "custom",
        path,
        message,
    };
}
function runParticipantKey(participant) {
    return JSON.stringify([
        "run",
        participant.model,
        participant.harness ?? null,
        participant.harness_version ?? null,
    ]);
}
export function validateResultForEval(context, resultFile) {
    const issues = [];
    let teamGamesShowcaseCount = 0;
    const origin = resultFile.submission.kind === "upstream_author_publication"
        ? "upstream_author_publication"
        : "run";
    if (resultFile.eval_id !== context.id) {
        issues.push(customIssue(["eval_id"], `result eval_id must match eval.id "${context.id}"`));
    }
    if (origin === "upstream_author_publication" &&
        context.scored_by !== "author") {
        issues.push(customIssue(["submission", "kind"], "upstream_author_publication submissions require an eval with scored_by=author"));
    }
    if ((context.interface === "chat" || context.interface === "agent") &&
        resultFile.results.length !== 1) {
        issues.push(customIssue(["results"], `interface=${context.interface} requires exactly one result`));
    }
    if (context.interface === "dialogue" && resultFile.results.length < 2) {
        issues.push(customIssue(["results"], "interface=dialogue requires at least two results"));
    }
    const dialogueParticipants = new Set();
    const envelopeParticipants = new Set(resultFile.results.map((result) => runParticipantKey(result.participant)));
    const legacyEnvelopeParticipants = new Set(resultFile.results.map((result) => result.participant.model));
    for (const [index, result] of resultFile.results.entries()) {
        const participantPath = ["results", index, "participant"];
        const participantValidation = validateParticipantForEval(context, result.participant, origin);
        if (!participantValidation.success) {
            for (const issue of participantValidation.error.issues) {
                issues.push(customIssue([...participantPath, ...issue.path], issue.message));
            }
        }
        if (context.interface === "dialogue") {
            const identity = runParticipantKey(result.participant);
            if (dialogueParticipants.has(identity)) {
                issues.push(customIssue([...participantPath, "model"], "dialogue participant identities must be unique"));
            }
            else {
                dialogueParticipants.add(identity);
            }
        }
        // 判分模型（2026-07-18 拍板）：
        // - scored_by=author 表示「作者判分选项开启」——既收自带分数（默认模式，待作者认可），
        //   也收 score=null（请作者判分）；两种都合法，不再强制 null。
        // - 非 author 评测集未开启作者判分：score=null 无人回填，必须自带分数。
        // 默认「分」制评测集保持 0-100 契约；自定义量纲（score_unit 非「分」）放开上限（≥0 有限已在基础校验）。
        if ((context.score_unit ?? "分") === "分" && result.score !== null && result.score > 100) {
            issues.push(customIssue(["results", index, "score"], "「分」制评测集 score 必须在 0-100 内"));
        }
        if (origin === "upstream_author_publication" &&
            result.score === null) {
            issues.push(customIssue(["results", index, "score"], "upstream_author_publication submissions must include a non-null score"));
        }
        if (context.scored_by !== "author" && result.score === null) {
            issues.push(customIssue(["results", index, "score"], `该评测集未开启作者判分（scored_by=${context.scored_by}），提交必须自带非空 score`));
        }
        if (origin === "upstream_author_publication") {
            for (const field of ["usage", "task_results", "showcases"]) {
                if (result[field] !== undefined) {
                    issues.push(customIssue(["results", index, field], `upstream_author_publication results cannot include ${field}`));
                }
            }
            continue;
        }
        for (const [showcaseIndex, showcase] of (result.showcases ?? []).entries()) {
            if (showcase.type !== "head_to_head" && showcase.type !== "team_games") {
                continue;
            }
            const showcasePath = ["results", index, "showcases", showcaseIndex];
            if (context.interface !== "dialogue") {
                issues.push(customIssue([...showcasePath, "type"], `${showcase.type} showcases require interface=dialogue`));
                continue;
            }
            if (showcase.type === "team_games") {
                teamGamesShowcaseCount += 1;
            }
            for (const [participantIndex, participant] of showcase.participants.entries()) {
                const legacyHeadToHeadParticipant = showcase.type === "head_to_head" &&
                    legacyEnvelopeParticipants.has(participant.key);
                if (!envelopeParticipants.has(participant.key) &&
                    !legacyHeadToHeadParticipant) {
                    issues.push(customIssue([...showcasePath, "participants", participantIndex, "key"], `${showcase.type} participant must occur in the same dialogue envelope`));
                }
            }
            if (showcase.type === "team_games" &&
                showcase.participants.length !== envelopeParticipants.size) {
                issues.push(customIssue([...showcasePath, "participants"], "team_games participants must exactly cover the dialogue envelope"));
            }
            if (showcase.type === "team_games" &&
                context.trials !== undefined &&
                showcase.games.length !== context.trials) {
                issues.push(customIssue([...showcasePath, "games"], `team_games must contain exactly trials=${context.trials} games`));
            }
        }
    }
    if (context.leaderboard === "rating" && teamGamesShowcaseCount !== 1) {
        issues.push(customIssue(["results"], "leaderboard=rating requires exactly one team_games showcase per dialogue envelope"));
    }
    else if (teamGamesShowcaseCount > 1) {
        issues.push(customIssue(["results"], "a dialogue envelope may contain at most one team_games showcase"));
    }
    if (issues.length > 0) {
        return { success: false, error: new z.ZodError(issues) };
    }
    return { success: true, data: resultFile };
}
