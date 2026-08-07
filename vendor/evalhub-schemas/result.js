import { z } from "zod";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const PARTICIPANT_MODEL_MAX_LENGTH = 255;
const HEAD_TO_HEAD_MAX_PARTICIPANTS = 8;
const HEAD_TO_HEAD_MAX_MATCHUPS = 28;
const HEAD_TO_HEAD_TITLE_MAX_LENGTH = 200;
const HEAD_TO_HEAD_PARTICIPANT_KEY_MAX_LENGTH = 255;
const HEAD_TO_HEAD_PARTICIPANT_LABEL_MAX_LENGTH = 200;
const TEAM_GAMES_MAX_PARTICIPANTS = 8;
const TEAM_GAMES_MAX_GAMES = 100;
const TEAM_GAMES_KEY_MAX_LENGTH = 1_024;
const TEAM_GAMES_SIDE_KEY_MAX_LENGTH = 100;
// The launch dialogue protocol accepts at most 100 trials, so a single pair
// cannot have more recorded outcomes than this without contradicting the run.
export const HEAD_TO_HEAD_MAX_GAMES_PER_MATCHUP = 100;
// These caps are tens of times above today's largest launch envelopes (8
// results, 15 tasks, 4 showcases). Ingest writes results serially; one result's
// largest bulk inserts bind at most 4 * 1,024 task fields and 3 * 256 showcase
// fields, well below PostgreSQL's 65,535-parameter protocol limit.
export const RESULT_FILE_MAX_RESULTS = 256;
export const RESULT_ENTRY_MAX_TASK_RESULTS = 1_024;
export const RESULT_ENTRY_MAX_SHOWCASES = 256;
export const RESULT_ENTRY_MAX_SUPPLEMENTARY_VIEWS = 32;
// Showcase task anchoring (compare/transcript.task_id → eval task id)：让战报
// 可挂到具体题目，详情页按题聚合展示。上限对齐 participant key 的 255。
export const SHOWCASE_TASK_ID_MAX_LENGTH = 255;
const ShowcaseTaskIdSchema = z
    .string()
    .min(1, "showcase task_id must not be empty")
    .max(SHOWCASE_TASK_ID_MAX_LENGTH, `showcase task_id must be at most ${SHOWCASE_TASK_ID_MAX_LENGTH} characters`);
const HeadToHeadOutcomeCountSchema = z
    .number()
    .int()
    .nonnegative()
    .refine((value) => !Number.isInteger(value) || Number.isSafeInteger(value), {
    message: "head_to_head outcome counts must be safe integers",
});
function participantIdentityPartSchema(field) {
    return z.string().superRefine((value, ctx) => {
        if (value.trim().length === 0) {
            ctx.addIssue({
                code: "custom",
                message: `participant.${field} must not be empty or whitespace`,
            });
        }
        if (CONTROL_CHARACTERS.test(value)) {
            ctx.addIssue({
                code: "custom",
                message: `participant.${field} must not contain control characters`,
            });
        }
        if (value.length > PARTICIPANT_MODEL_MAX_LENGTH) {
            ctx.addIssue({
                code: "custom",
                message: `participant.${field} must be at most ${PARTICIPANT_MODEL_MAX_LENGTH} characters`,
            });
        }
    });
}
export const ParticipantHarnessSchema = participantIdentityPartSchema("harness");
export const ParticipantHarnessVersionSchema = participantIdentityPartSchema("harness_version");
export const ParticipantModelSchema = z.string().min(4).superRefine((value, ctx) => {
    if (value.trim().length === 0) {
        ctx.addIssue({
            code: "custom",
            message: "participant.model must not be empty or whitespace",
        });
    }
    if (value !== value.trim()) {
        ctx.addIssue({
            code: "custom",
            message: "participant.model must be already trimmed",
        });
    }
    if (value.length > PARTICIPANT_MODEL_MAX_LENGTH) {
        ctx.addIssue({
            code: "custom",
            message: `participant.model must be at most ${PARTICIPANT_MODEL_MAX_LENGTH} characters`,
        });
    }
    if (CONTROL_CHARACTERS.test(value)) {
        ctx.addIssue({
            code: "custom",
            message: "participant.model must not contain control characters",
        });
    }
});
export const ParticipantAdapterSchema = z.enum(["api", "command"]);
export const ParticipantConfigSchema = z
    .record(z.unknown())
    .superRefine((config, ctx) => {
    if (!Object.prototype.hasOwnProperty.call(config, "adapter")) {
        return;
    }
    if (!ParticipantAdapterSchema.safeParse(config.adapter).success) {
        ctx.addIssue({
            code: "custom",
            path: ["adapter"],
            message: "participant.config.adapter must be api or command",
        });
    }
});
const HeadToHeadShowcaseObjectSchema = z.object({
    type: z.literal("head_to_head"),
    title: z
        .string()
        .max(HEAD_TO_HEAD_TITLE_MAX_LENGTH, `head_to_head title must be at most ${HEAD_TO_HEAD_TITLE_MAX_LENGTH} characters`),
    participants: z
        .array(z.object({
        key: z
            .string()
            .max(HEAD_TO_HEAD_PARTICIPANT_KEY_MAX_LENGTH, `head_to_head participant key must be at most ${HEAD_TO_HEAD_PARTICIPANT_KEY_MAX_LENGTH} characters`),
        label: z
            .string()
            .max(HEAD_TO_HEAD_PARTICIPANT_LABEL_MAX_LENGTH, `head_to_head participant label must be at most ${HEAD_TO_HEAD_PARTICIPANT_LABEL_MAX_LENGTH} characters`),
    }))
        .min(2)
        .max(HEAD_TO_HEAD_MAX_PARTICIPANTS, `head_to_head participants cannot exceed ${HEAD_TO_HEAD_MAX_PARTICIPANTS}`),
    matchups: z
        .array(z.object({
        a: z.string(),
        b: z.string(),
        a_wins: HeadToHeadOutcomeCountSchema,
        b_wins: HeadToHeadOutcomeCountSchema,
        draws: HeadToHeadOutcomeCountSchema,
    }))
        .max(HEAD_TO_HEAD_MAX_MATCHUPS, `head_to_head matchups cannot exceed ${HEAD_TO_HEAD_MAX_MATCHUPS}`),
});
function refineHeadToHeadShowcase(showcase, ctx) {
    let participantsValid = showcase.participants.length >= 2 &&
        showcase.participants.length <= HEAD_TO_HEAD_MAX_PARTICIPANTS;
    const keys = new Set();
    const labels = new Set();
    if (showcase.title.trim().length === 0) {
        ctx.addIssue({
            code: "custom",
            path: ["title"],
            message: "head_to_head title must not be empty or whitespace",
        });
    }
    for (const [index, participant] of showcase.participants.entries()) {
        if (participant.key.trim().length === 0) {
            participantsValid = false;
            ctx.addIssue({
                code: "custom",
                path: ["participants", index, "key"],
                message: "head_to_head participant key must not be empty or whitespace",
            });
        }
        else if (keys.has(participant.key)) {
            participantsValid = false;
            ctx.addIssue({
                code: "custom",
                path: ["participants", index, "key"],
                message: "head_to_head participant keys must be unique",
            });
        }
        keys.add(participant.key);
        if (participant.label.trim().length === 0) {
            participantsValid = false;
            ctx.addIssue({
                code: "custom",
                path: ["participants", index, "label"],
                message: "head_to_head participant label must not be empty or whitespace",
            });
        }
        else if (labels.has(participant.label)) {
            participantsValid = false;
            ctx.addIssue({
                code: "custom",
                path: ["participants", index, "label"],
                message: "head_to_head participant labels must be unique",
            });
        }
        labels.add(participant.label);
    }
    if (!participantsValid) {
        return;
    }
    const pairCapacity = (showcase.participants.length * (showcase.participants.length - 1)) / 2;
    if (showcase.matchups.length > pairCapacity) {
        ctx.addIssue({
            code: "custom",
            path: ["matchups"],
            message: "head_to_head matchups cannot exceed the declared participant pair capacity",
        });
    }
    const unorderedPairs = new Set();
    for (const [index, matchup] of showcase.matchups.entries()) {
        if (matchup.a === matchup.b) {
            ctx.addIssue({
                code: "custom",
                path: ["matchups", index, "b"],
                message: "head_to_head matchups cannot pair a participant with itself",
            });
            continue;
        }
        if (!keys.has(matchup.a)) {
            ctx.addIssue({
                code: "custom",
                path: ["matchups", index, "a"],
                message: "head_to_head matchup a must reference a declared participant",
            });
        }
        if (!keys.has(matchup.b)) {
            ctx.addIssue({
                code: "custom",
                path: ["matchups", index, "b"],
                message: "head_to_head matchup b must reference a declared participant",
            });
        }
        const pairKey = JSON.stringify([matchup.a, matchup.b].sort());
        if (unorderedPairs.has(pairKey)) {
            ctx.addIssue({
                code: "custom",
                path: ["matchups", index],
                message: "head_to_head unordered matchup pairs must be unique",
            });
        }
        unorderedPairs.add(pairKey);
        const outcomeCounts = [matchup.a_wins, matchup.b_wins, matchup.draws];
        if (!outcomeCounts.every((count) => Number.isSafeInteger(count) && count >= 0)) {
            continue;
        }
        const gameTotal = matchup.a_wins + matchup.b_wins + matchup.draws;
        if (!Number.isSafeInteger(gameTotal)) {
            ctx.addIssue({
                code: "custom",
                path: ["matchups", index],
                message: "head_to_head matchup game total must be a safe integer",
            });
            continue;
        }
        if (gameTotal === 0) {
            ctx.addIssue({
                code: "custom",
                path: ["matchups", index],
                message: "head_to_head matchup must contain at least one game",
            });
        }
        else if (gameTotal > HEAD_TO_HEAD_MAX_GAMES_PER_MATCHUP) {
            ctx.addIssue({
                code: "custom",
                path: ["matchups", index],
                message: `head_to_head matchup cannot exceed ${HEAD_TO_HEAD_MAX_GAMES_PER_MATCHUP} games`,
            });
        }
    }
}
export const HeadToHeadShowcaseSchema = HeadToHeadShowcaseObjectSchema.superRefine(refineHeadToHeadShowcase);
const TeamGameSideSchema = z.object({
    key: z
        .string()
        .min(1, "team_games side key must not be empty")
        .max(TEAM_GAMES_SIDE_KEY_MAX_LENGTH, `team_games side key must be at most ${TEAM_GAMES_SIDE_KEY_MAX_LENGTH} characters`),
    participants: z
        .array(z
        .string()
        .min(1, "team_games participant key must not be empty")
        .max(TEAM_GAMES_KEY_MAX_LENGTH, `team_games participant key must be at most ${TEAM_GAMES_KEY_MAX_LENGTH} characters`))
        .min(1)
        .max(TEAM_GAMES_MAX_PARTICIPANTS),
});
const TeamGamesShowcaseObjectSchema = z.object({
    type: z.literal("team_games"),
    title: z.string().min(1).max(HEAD_TO_HEAD_TITLE_MAX_LENGTH),
    participants: z
        .array(z.object({
        key: z.string().min(1).max(TEAM_GAMES_KEY_MAX_LENGTH),
        label: z.string().min(1).max(HEAD_TO_HEAD_PARTICIPANT_LABEL_MAX_LENGTH),
    }))
        .min(2)
        .max(TEAM_GAMES_MAX_PARTICIPANTS),
    games: z
        .array(z.object({
        game_no: z.number().int().positive().safe(),
        sides: z.tuple([TeamGameSideSchema, TeamGameSideSchema]),
        winner: z.string().min(1).max(TEAM_GAMES_SIDE_KEY_MAX_LENGTH),
    }))
        .min(1)
        .max(TEAM_GAMES_MAX_GAMES),
});
function refineTeamGamesShowcase(showcase, ctx) {
    const declared = new Set();
    for (const [index, participant] of showcase.participants.entries()) {
        if (declared.has(participant.key)) {
            ctx.addIssue({
                code: "custom",
                path: ["participants", index, "key"],
                message: "team_games participant keys must be unique",
            });
        }
        declared.add(participant.key);
    }
    const gameNumbers = new Set();
    for (const [gameIndex, game] of showcase.games.entries()) {
        if (gameNumbers.has(game.game_no)) {
            ctx.addIssue({
                code: "custom",
                path: ["games", gameIndex, "game_no"],
                message: "team_games game_no values must be unique",
            });
        }
        gameNumbers.add(game.game_no);
        const [sideA, sideB] = game.sides;
        if (sideA.key === sideB.key) {
            ctx.addIssue({
                code: "custom",
                path: ["games", gameIndex, "sides", 1, "key"],
                message: "team_games side keys must be distinct within a game",
            });
        }
        if (game.winner !== sideA.key && game.winner !== sideB.key) {
            ctx.addIssue({
                code: "custom",
                path: ["games", gameIndex, "winner"],
                message: "team_games winner must reference one of the two side keys",
            });
        }
        const assigned = new Set();
        for (const [sideIndex, side] of game.sides.entries()) {
            for (const [participantIndex, key] of side.participants.entries()) {
                if (!declared.has(key)) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["games", gameIndex, "sides", sideIndex, "participants", participantIndex],
                        message: "team_games game participant must be declared by the showcase",
                    });
                }
                if (assigned.has(key)) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["games", gameIndex, "sides", sideIndex, "participants", participantIndex],
                        message: "team_games participant may occur on only one side per game",
                    });
                }
                assigned.add(key);
            }
        }
        if (assigned.size !== declared.size) {
            ctx.addIssue({
                code: "custom",
                path: ["games", gameIndex, "sides"],
                message: "team_games game sides must exactly cover declared participants",
            });
        }
    }
}
export const TeamGamesShowcaseSchema = TeamGamesShowcaseObjectSchema.superRefine(refineTeamGamesShowcase);
const SUPPLEMENTARY_VIEW_TITLE_MAX_LENGTH = 200;
const SUPPLEMENTARY_VIEW_LABEL_MAX_LENGTH = 80;
const SUPPLEMENTARY_VIEW_NOTE_MAX_LENGTH = 2_000;
const METRIC_TABLE_MAX_COLUMNS = 20;
const METRIC_TABLE_MAX_ROWS = 200;
const METRIC_TABLE_CELL_MAX_LENGTH = 500;
const LINE_CHART_MAX_SERIES = 12;
const LINE_CHART_MAX_POINTS_PER_SERIES = 500;
const SupplementaryViewTitleSchema = z
    .string()
    .min(1, "supplementary view title must not be empty")
    .max(SUPPLEMENTARY_VIEW_TITLE_MAX_LENGTH);
const SupplementaryViewIdSchema = z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "supplementary view id must be a stable lowercase slug");
const SupplementaryViewLabelSchema = z
    .string()
    .min(1, "supplementary view label must not be empty")
    .max(SUPPLEMENTARY_VIEW_LABEL_MAX_LENGTH)
    .optional();
const SupplementaryViewIdentityShape = {
    id: SupplementaryViewIdSchema.optional(),
    label: SupplementaryViewLabelSchema,
};
const SupplementaryViewNoteSchema = z
    .string()
    .min(1, "supplementary view note must not be empty")
    .max(SUPPLEMENTARY_VIEW_NOTE_MAX_LENGTH)
    .optional();
const MetricTableViewObjectSchema = z.object({
    type: z.literal("metric_table"),
    ...SupplementaryViewIdentityShape,
    title: SupplementaryViewTitleSchema,
    columns: z
        .array(z
        .string()
        .min(1, "metric_table column must not be empty")
        .max(METRIC_TABLE_CELL_MAX_LENGTH))
        .min(1)
        .max(METRIC_TABLE_MAX_COLUMNS),
    rows: z
        .array(z.object({
        cells: z
            .array(z.union([
            z.string().max(METRIC_TABLE_CELL_MAX_LENGTH),
            z.number().finite(),
            z.null(),
        ]))
            .max(METRIC_TABLE_MAX_COLUMNS),
    }))
        .min(1)
        .max(METRIC_TABLE_MAX_ROWS),
    note: SupplementaryViewNoteSchema,
});
function refineMetricTableView(view, ctx) {
    const seenColumns = new Set();
    for (const [index, column] of view.columns.entries()) {
        if (column.trim().length === 0) {
            ctx.addIssue({
                code: "custom",
                path: ["columns", index],
                message: "metric_table column must not be empty or whitespace",
            });
        }
        if (seenColumns.has(column)) {
            ctx.addIssue({
                code: "custom",
                path: ["columns", index],
                message: "metric_table columns must be unique",
            });
        }
        seenColumns.add(column);
    }
    for (const [index, row] of view.rows.entries()) {
        if (row.cells.length !== view.columns.length) {
            ctx.addIssue({
                code: "custom",
                path: ["rows", index, "cells"],
                message: "metric_table row cells must match the column count",
            });
        }
    }
}
const LineChartViewObjectSchema = z.object({
    type: z.literal("line_chart"),
    ...SupplementaryViewIdentityShape,
    title: SupplementaryViewTitleSchema,
    x_label: z.string().min(1).max(100).optional(),
    y_label: z.string().min(1).max(100).optional(),
    series: z
        .array(z.object({
        name: z.string().min(1).max(120),
        points: z
            .array(z.object({
            x: z.union([z.string().min(1).max(120), z.number().finite()]),
            y: z.number().finite(),
        }))
            .min(1)
            .max(LINE_CHART_MAX_POINTS_PER_SERIES),
    }))
        .min(1)
        .max(LINE_CHART_MAX_SERIES),
    note: SupplementaryViewNoteSchema,
});
function refineLineChartView(view, ctx) {
    const seenSeries = new Set();
    for (const [seriesIndex, series] of view.series.entries()) {
        if (series.name.trim().length === 0) {
            ctx.addIssue({
                code: "custom",
                path: ["series", seriesIndex, "name"],
                message: "line_chart series name must not be empty or whitespace",
            });
        }
        if (seenSeries.has(series.name)) {
            ctx.addIssue({
                code: "custom",
                path: ["series", seriesIndex, "name"],
                message: "line_chart series names must be unique",
            });
        }
        seenSeries.add(series.name);
        const seenX = new Set();
        for (const [pointIndex, point] of series.points.entries()) {
            const xKey = JSON.stringify([typeof point.x, point.x]);
            if (seenX.has(xKey)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["series", seriesIndex, "points", pointIndex, "x"],
                    message: "line_chart x values must be unique within a series",
                });
            }
            seenX.add(xKey);
        }
    }
}
const SupplementaryViewDiscriminatedUnionSchema = z.discriminatedUnion("type", [
    MetricTableViewObjectSchema,
    LineChartViewObjectSchema,
]);
export const SupplementaryViewSchema = SupplementaryViewDiscriminatedUnionSchema.superRefine((view, ctx) => {
    if (view.type === "metric_table") {
        refineMetricTableView(view, ctx);
    }
    if (view.type === "line_chart") {
        refineLineChartView(view, ctx);
    }
});
const ShowcaseDiscriminatedUnionSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("compare"),
        task: z.string(),
        // 可选挂题：等于 eval 任务 id 时，详情页把该战报聚合进对应示例题的模型 tab
        task_id: ShowcaseTaskIdSchema.optional(),
        content: z.string(),
        expected: z.string().optional(),
        verdict: z.string().optional(),
        score: z.number().optional(),
    }),
    z.object({
        type: z.literal("transcript"),
        title: z.string(),
        // 可选挂题：同 compare.task_id
        task_id: ShowcaseTaskIdSchema.optional(),
        turns: z
            .array(z.object({ role: z.string(), content: z.string(), status: z.string().optional() }))
            .min(1),
    }),
    z.object({
        type: z.literal("timeline"),
        title: z.string(),
        series: z.array(z.object({ t: z.string(), v: z.number() })).optional(),
        events: z.array(z.object({ t: z.string(), label: z.string() })).min(1),
    }),
    z.object({
        type: z.literal("image"),
        src: z.string(),
        caption: z.string().optional(),
        score: z.number().optional(),
    }),
    HeadToHeadShowcaseObjectSchema,
    TeamGamesShowcaseObjectSchema,
]);
export const ShowcaseSchema = ShowcaseDiscriminatedUnionSchema.superRefine((showcase, ctx) => {
    if (showcase.type === "head_to_head") {
        refineHeadToHeadShowcase(showcase, ctx);
    }
    if (showcase.type === "team_games") {
        refineTeamGamesShowcase(showcase, ctx);
    }
});
const ResultEntryObjectSchema = z.object({
    participant: z.object({
        model: ParticipantModelSchema,
        harness: ParticipantHarnessSchema.optional(),
        harness_version: ParticipantHarnessVersionSchema.optional(),
        config: ParticipantConfigSchema.optional(),
    }),
    // results[] 构成可排名的主结果表；score 是每行的主成绩。评测集可另外声明
    // raw_metric.tiebreak_value 作为同分规则，评测榜名次再派生全站积分。量纲由
    // 评测集自定（2026-07-20 owner 计分模型）：默认「分」制 0-100 在
    // result-for-eval 的 eval 感知校验里收紧；自定义量纲只要求 ≥0 有限值。
    score: z.number().finite().min(0).nullable(),
    // tiebreak_value（可选数值键）：供评测集级同分 tiebreak（eval.yaml tiebreak 声明）排序用
    raw_metric: z
        .object({
        label: z.string(),
        value: z.string(),
        tiebreak_value: z.number().finite().optional(),
    })
        .optional(),
    detail: z.string().optional(),
    usage: z.object({ tokens: z.number().int() }).partial().optional(),
    task_results: z
        .array(z.object({ task_id: z.string(), score: z.number(), raw: z.string().optional() }))
        .max(RESULT_ENTRY_MAX_TASK_RESULTS, `result task_results cannot exceed ${RESULT_ENTRY_MAX_TASK_RESULTS}`)
        .optional(),
    showcases: z
        .array(ShowcaseSchema)
        .max(RESULT_ENTRY_MAX_SHOWCASES, `result showcases cannot exceed ${RESULT_ENTRY_MAX_SHOWCASES}`)
        .optional(),
    // 结构化辅助展示永不成为 score / tiebreak 输入，也不作为逐题运行证据。
    // 表格和折线图只负责解释主结果、展示分项或其他观察角度。
    supplementary_views: z
        .array(SupplementaryViewSchema)
        .max(RESULT_ENTRY_MAX_SUPPLEMENTARY_VIEWS, `result supplementary_views cannot exceed ${RESULT_ENTRY_MAX_SUPPLEMENTARY_VIEWS}`)
        .optional(),
});
export const ResultEntrySchema = ResultEntryObjectSchema.superRefine((result, ctx) => {
    const supplementaryViewIds = new Set();
    for (const [index, view] of (result.supplementary_views ?? []).entries()) {
        if (view.id === undefined) {
            continue;
        }
        if (supplementaryViewIds.has(view.id)) {
            ctx.addIssue({
                code: "custom",
                path: ["supplementary_views", index, "id"],
                message: "supplementary view ids must be unique within one result",
            });
        }
        else {
            supplementaryViewIds.add(view.id);
        }
    }
});
const IsoCalendarDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
    const [yearText, monthText, dayText] = value.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (year < 1 || month < 1 || month > 12 || day < 1) {
        return false;
    }
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [
        31,
        leapYear ? 29 : 28,
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
}, "must be a real YYYY-MM-DD calendar date");
export const RunSubmissionSchema = z.object({
    kind: z.literal("run").optional(),
    runner_version: z.string(),
    run_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const UpstreamPublicationImporterVersionSchema = z
    .string()
    .min(1)
    .max(255)
    .refine((value) => value === value.trim(), {
    message: "must be already trimmed",
})
    .refine((value) => !CONTROL_CHARACTERS.test(value), {
    message: "must not contain control characters",
});
const UpstreamPublicationTitleSchema = z
    .string()
    .min(1)
    .max(500)
    .refine((value) => value === value.trim(), {
    message: "must be already trimmed",
})
    .refine((value) => !CONTROL_CHARACTERS.test(value), {
    message: "must not contain control characters",
});
export const UpstreamAuthorPublicationSubmissionSchema = z
    .object({
    kind: z.literal("upstream_author_publication"),
    importer_version: UpstreamPublicationImporterVersionSchema,
    retrieved_on: IsoCalendarDateSchema,
    source: z
        .object({
        title: UpstreamPublicationTitleSchema.optional(),
        url: z
            .string()
            .max(2_048)
            .url()
            .refine((value) => {
            try {
                const parsed = new URL(value);
                return (parsed.protocol === "https:" &&
                    parsed.username === "" &&
                    parsed.password === "");
            }
            catch {
                return false;
            }
        }, {
            message: "source.url must use https without embedded credentials",
        }),
        snapshot_sha256: z
            .string()
            .regex(/^[0-9a-f]{64}$/, "source.snapshot_sha256 must be 64 lowercase hexadecimal characters"),
    })
        .strict(),
})
    .strict();
export const ResultSubmissionSchema = z.union([
    UpstreamAuthorPublicationSubmissionSchema,
    RunSubmissionSchema,
]);
export const ResultFileSchema = z
    .object({
    eval_id: z.string(),
    eval_commit: z.string().optional(),
    submission: ResultSubmissionSchema,
    results: z
        .array(ResultEntrySchema)
        .min(1)
        .max(RESULT_FILE_MAX_RESULTS, `result file results cannot exceed ${RESULT_FILE_MAX_RESULTS}`),
})
    .superRefine((file, ctx) => {
    for (const [index, result] of file.results.entries()) {
        const participant = result.participant;
        if (file.submission.kind !== "upstream_author_publication" &&
            participant.harness !== undefined &&
            participant.harness_version === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["results", index, "participant", "harness_version"],
                message: "填了 harness 必带 harness_version",
            });
        }
        if (participant.harness_version !== undefined &&
            participant.harness === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["results", index, "participant", "harness"],
                message: "填了 harness_version 必带 harness",
            });
        }
    }
});
