import { z } from "zod";
import { validateParticipantForEval, } from "./participant-for-eval.js";
import { isUpstreamAuthorPublicationSubmission, } from "./result.js";
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
export function validateResultForEval(context, resultFile, options = {}) {
    const issues = [];
    let teamGamesShowcaseCount = 0;
    // Derived from the provenance block, not the optional kind tag -- a file that
    // omits the tag is still an upstream publication, and origin gates the
    // run-only cardinality, identity and score rules below.
    const upstreamSubmission = isUpstreamAuthorPublicationSubmission(resultFile.submission)
        ? resultFile.submission
        : null;
    const origin = upstreamSubmission
        ? "upstream_author_publication"
        : "run";
    if (upstreamSubmission && options.requireOfficialResultCount) {
        const source = upstreamSubmission.source;
        const omittedModels = source.omitted_models ?? [];
        const resultModels = new Set(resultFile.results.map((result) => result.participant.model));
        if (source.official_result_count === undefined) {
            issues.push(customIssue(["submission", "source", "official_result_count"], "upstream_author_publication requires source.official_result_count when requireOfficialResultCount is enabled"));
        }
        else if (source.official_result_count !==
            resultFile.results.length + omittedModels.length) {
            issues.push(customIssue(["submission", "source", "official_result_count"], "source.official_result_count must equal results.length + omitted_models.length"));
        }
        for (const [index, omitted] of omittedModels.entries()) {
            if (resultModels.has(omitted.model)) {
                issues.push(customIssue(["submission", "source", "omitted_models", index, "model"], "omitted_models cannot include a model present in results"));
            }
        }
    }
    if (resultFile.eval_id !== context.id) {
        issues.push(customIssue(["eval_id"], `result eval_id must match eval.id "${context.id}"`));
    }
    // A real run envelope mirrors one execution session, so its cardinality is
    // dictated by the eval interface. An upstream publication is instead one
    // source snapshot and may legitimately publish a whole official leaderboard
    // in the same envelope, irrespective of the interface used by real runs.
    if (origin === "run" &&
        (context.interface === "chat" || context.interface === "agent") &&
        resultFile.results.length !== 1) {
        issues.push(customIssue(["results"], `interface=${context.interface} requires exactly one result`));
    }
    if (origin === "run" &&
        context.interface === "dialogue" &&
        resultFile.results.length < 2) {
        issues.push(customIssue(["results"], "interface=dialogue requires at least two results"));
    }
    const dialogueParticipants = new Set();
    const upstreamParticipants = new Set();
    const envelopeParticipants = new Set(resultFile.results.map((result) => runParticipantKey(result.participant)));
    const evalTaskIds = new Set((context.tasks ?? []).flatMap((task) => task.id === undefined ? [] : [task.id]));
    // StoredEvalDef intentionally keeps task ids optional so historical evals
    // remain readable. Repository authoring requires ids for every new/updated
    // definition; only those fully identified task sets can safely enforce
    // referential integrity without rejecting legacy run evidence.
    const enforceTaskReferences = context.tasks !== undefined &&
        context.tasks.every((task) => task.id !== undefined);
    for (const [index, result] of resultFile.results.entries()) {
        const participantPath = ["results", index, "participant"];
        const participantValidation = validateParticipantForEval(context, result.participant, origin);
        if (!participantValidation.success) {
            for (const issue of participantValidation.error.issues) {
                issues.push(customIssue([...participantPath, ...issue.path], issue.message));
            }
        }
        if (origin === "upstream_author_publication") {
            const identity = runParticipantKey(result.participant);
            if (upstreamParticipants.has(identity)) {
                issues.push(customIssue([...participantPath, "model"], "upstream publication participant identities must be unique"));
            }
            else {
                upstreamParticipants.add(identity);
            }
        }
        else if (context.interface === "dialogue") {
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
        const taskResultCounts = new Map();
        const maxTaskResultsPerTask = context.trials ?? 1;
        for (const [taskResultIndex, taskResult] of (result.task_results ?? []).entries()) {
            const taskIdPath = [
                "results",
                index,
                "task_results",
                taskResultIndex,
                "task_id",
            ];
            if (enforceTaskReferences && !evalTaskIds.has(taskResult.task_id)) {
                issues.push(customIssue(taskIdPath, "task_results[].task_id must reference an eval task id"));
            }
            const taskResultCount = (taskResultCounts.get(taskResult.task_id) ?? 0) + 1;
            taskResultCounts.set(taskResult.task_id, taskResultCount);
            if (taskResultCount > maxTaskResultsPerTask) {
                issues.push(customIssue(taskIdPath, `duplicate task_result for the same task_id exceeds eval.trials=${maxTaskResultsPerTask}`));
            }
        }
        for (const [showcaseIndex, showcase] of (result.showcases ?? []).entries()) {
            if ((showcase.type === "compare" || showcase.type === "transcript") &&
                showcase.task_id !== undefined &&
                enforceTaskReferences &&
                !evalTaskIds.has(showcase.task_id)) {
                issues.push(customIssue(["results", index, "showcases", showcaseIndex, "task_id"], "showcase task_id must reference an eval task id"));
            }
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
    if (origin === "run" &&
        context.leaderboard === "rating" &&
        teamGamesShowcaseCount !== 1) {
        issues.push(customIssue(["results"], "leaderboard=rating requires exactly one team_games showcase per dialogue envelope"));
    }
    else if (origin === "run" && teamGamesShowcaseCount > 1) {
        issues.push(customIssue(["results"], "a dialogue envelope may contain at most one team_games showcase"));
    }
    if (issues.length > 0) {
        return { success: false, error: new z.ZodError(issues) };
    }
    return { success: true, data: resultFile };
}
