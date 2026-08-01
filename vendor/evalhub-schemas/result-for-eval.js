import { z } from "zod";
import { validateParticipantForEval, } from "./participant-for-eval.js";
import { resolveScorePolicy } from "./eval-def.js";
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
    if ((context.interface === "chat" || context.interface === "agent") &&
        resultFile.results.length !== 1) {
        issues.push(customIssue(["results"], `interface=${context.interface} requires exactly one result`));
    }
    if (context.interface === "dialogue" && resultFile.results.length < 2) {
        issues.push(customIssue(["results"], "interface=dialogue requires at least two results"));
    }
    const dialogueParticipants = new Set();
    const envelopeParticipants = new Set(resultFile.results.map((result) => runParticipantKey(result.participant)));
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
        // scored_by 只表达谁有权认可成绩；score_policy 独立表达是否允许先交空分。
        // 未声明 score_policy 的旧评测保持兼容（author => author_fill，local => required）。
        // 默认「分」制评测集保持 0-100 契约；自定义量纲（score_unit 非「分」）放开上限（≥0 有限已在基础校验）。
        if ((context.score_unit ?? "分") === "分" && result.score !== null && result.score > 100) {
            issues.push(customIssue(["results", index, "score"], "「分」制评测集 score 必须在 0-100 内"));
        }
        if (origin === "upstream_author_publication" &&
            result.score === null) {
            issues.push(customIssue(["results", index, "score"], "upstream_author_publication submissions must include a non-null score"));
        }
        if (resolveScorePolicy(context) === "required" && result.score === null) {
            issues.push(customIssue(["results", index, "score"], "该评测集要求提交数值成绩（score_policy=required），score 不能为 null"));
        }
        if (origin === "upstream_author_publication") {
            // 上游官方发布不是本站复跑，因此逐题结果、运行用量和 showcase/输出证据
            // 一律禁止。来源中公布的分项或趋势只能进入 supplementary_views；
            // 这些结构化辅助视图不会参与任何榜单排序。
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
                if (!envelopeParticipants.has(participant.key)) {
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
