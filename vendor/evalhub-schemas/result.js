import { z } from "zod";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const HEAD_TO_HEAD_MAX_PARTICIPANTS = 8;
const HEAD_TO_HEAD_MAX_MATCHUPS = 28;
const HEAD_TO_HEAD_TITLE_MAX_LENGTH = 200;
const HEAD_TO_HEAD_PARTICIPANT_KEY_MAX_LENGTH = 255;
const HEAD_TO_HEAD_PARTICIPANT_LABEL_MAX_LENGTH = 200;
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
    });
}
export const ParticipantHarnessSchema = participantIdentityPartSchema("harness");
export const ParticipantHarnessVersionSchema = participantIdentityPartSchema("harness_version");
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
const ShowcaseDiscriminatedUnionSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("compare"),
        task: z.string(),
        content: z.string(),
        expected: z.string().optional(),
        verdict: z.string().optional(),
        score: z.number().optional(),
    }),
    z.object({
        type: z.literal("transcript"),
        title: z.string(),
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
]);
export const ShowcaseSchema = ShowcaseDiscriminatedUnionSchema.superRefine((showcase, ctx) => {
    if (showcase.type === "head_to_head") {
        refineHeadToHeadShowcase(showcase, ctx);
    }
});
export const ResultEntrySchema = z.object({
    participant: z
        .object({
        model: z.string().min(4),
        harness: ParticipantHarnessSchema.optional(),
        harness_version: ParticipantHarnessVersionSchema.optional(),
        config: ParticipantConfigSchema.optional(),
    })
        .superRefine((participant, ctx) => {
        if (participant.harness !== undefined &&
            participant.harness_version === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["harness_version"],
                message: "填了 harness 必带 harness_version",
            });
        }
        if (participant.harness_version !== undefined &&
            participant.harness === undefined) {
            ctx.addIssue({
                code: "custom",
                path: ["harness"],
                message: "填了 harness_version 必带 harness",
            });
        }
    }),
    score: z.number().min(0).max(100).nullable(),
    raw_metric: z.object({ label: z.string(), value: z.string() }).optional(),
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
});
export const ResultFileSchema = z.object({
    eval_id: z.string(),
    eval_commit: z.string().optional(),
    submission: z.object({
        runner_version: z.string(),
        run_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    results: z
        .array(ResultEntrySchema)
        .min(1)
        .max(RESULT_FILE_MAX_RESULTS, `result file results cannot exceed ${RESULT_FILE_MAX_RESULTS}`),
});
