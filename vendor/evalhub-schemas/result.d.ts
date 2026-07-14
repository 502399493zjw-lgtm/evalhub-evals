import { z } from "zod";
export declare const HEAD_TO_HEAD_MAX_GAMES_PER_MATCHUP = 100;
export declare const RESULT_FILE_MAX_RESULTS = 256;
export declare const RESULT_ENTRY_MAX_TASK_RESULTS = 1024;
export declare const RESULT_ENTRY_MAX_SHOWCASES = 256;
export declare const ParticipantHarnessSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const ParticipantHarnessVersionSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const ParticipantAdapterSchema: z.ZodEnum<["api", "command"]>;
export declare const ParticipantConfigSchema: z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodUnknown>, Record<string, unknown>, Record<string, unknown>>;
declare const HeadToHeadShowcaseObjectSchema: z.ZodObject<{
    type: z.ZodLiteral<"head_to_head">;
    title: z.ZodString;
    participants: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">;
    matchups: z.ZodArray<z.ZodObject<{
        a: z.ZodString;
        b: z.ZodString;
        a_wins: z.ZodEffects<z.ZodNumber, number, number>;
        b_wins: z.ZodEffects<z.ZodNumber, number, number>;
        draws: z.ZodEffects<z.ZodNumber, number, number>;
    }, "strip", z.ZodTypeAny, {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }, {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
}, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
}>;
type HeadToHeadShowcaseValue = z.infer<typeof HeadToHeadShowcaseObjectSchema>;
export declare const HeadToHeadShowcaseSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodLiteral<"head_to_head">;
    title: z.ZodString;
    participants: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">;
    matchups: z.ZodArray<z.ZodObject<{
        a: z.ZodString;
        b: z.ZodString;
        a_wins: z.ZodEffects<z.ZodNumber, number, number>;
        b_wins: z.ZodEffects<z.ZodNumber, number, number>;
        draws: z.ZodEffects<z.ZodNumber, number, number>;
    }, "strip", z.ZodTypeAny, {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }, {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
}, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
}>, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
}, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
}>;
export declare const ShowcaseSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"compare">;
    task: z.ZodString;
    content: z.ZodString;
    expected: z.ZodOptional<z.ZodString>;
    verdict: z.ZodOptional<z.ZodString>;
    score: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "compare";
    task: string;
    content: string;
    expected?: string | undefined;
    verdict?: string | undefined;
    score?: number | undefined;
}, {
    type: "compare";
    task: string;
    content: string;
    expected?: string | undefined;
    verdict?: string | undefined;
    score?: number | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"transcript">;
    title: z.ZodString;
    turns: z.ZodArray<z.ZodObject<{
        role: z.ZodString;
        content: z.ZodString;
        status: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        content: string;
        role: string;
        status?: string | undefined;
    }, {
        content: string;
        role: string;
        status?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "transcript";
    title: string;
    turns: {
        content: string;
        role: string;
        status?: string | undefined;
    }[];
}, {
    type: "transcript";
    title: string;
    turns: {
        content: string;
        role: string;
        status?: string | undefined;
    }[];
}>, z.ZodObject<{
    type: z.ZodLiteral<"timeline">;
    title: z.ZodString;
    series: z.ZodOptional<z.ZodArray<z.ZodObject<{
        t: z.ZodString;
        v: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        t: string;
        v: number;
    }, {
        t: string;
        v: number;
    }>, "many">>;
    events: z.ZodArray<z.ZodObject<{
        t: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        label: string;
        t: string;
    }, {
        label: string;
        t: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "timeline";
    title: string;
    events: {
        label: string;
        t: string;
    }[];
    series?: {
        t: string;
        v: number;
    }[] | undefined;
}, {
    type: "timeline";
    title: string;
    events: {
        label: string;
        t: string;
    }[];
    series?: {
        t: string;
        v: number;
    }[] | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"image">;
    src: z.ZodString;
    caption: z.ZodOptional<z.ZodString>;
    score: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "image";
    src: string;
    score?: number | undefined;
    caption?: string | undefined;
}, {
    type: "image";
    src: string;
    score?: number | undefined;
    caption?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"head_to_head">;
    title: z.ZodString;
    participants: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">;
    matchups: z.ZodArray<z.ZodObject<{
        a: z.ZodString;
        b: z.ZodString;
        a_wins: z.ZodEffects<z.ZodNumber, number, number>;
        b_wins: z.ZodEffects<z.ZodNumber, number, number>;
        draws: z.ZodEffects<z.ZodNumber, number, number>;
    }, "strip", z.ZodTypeAny, {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }, {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
}, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
}>]>, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
} | {
    type: "compare";
    task: string;
    content: string;
    expected?: string | undefined;
    verdict?: string | undefined;
    score?: number | undefined;
} | {
    type: "transcript";
    title: string;
    turns: {
        content: string;
        role: string;
        status?: string | undefined;
    }[];
} | {
    type: "timeline";
    title: string;
    events: {
        label: string;
        t: string;
    }[];
    series?: {
        t: string;
        v: number;
    }[] | undefined;
} | {
    type: "image";
    src: string;
    score?: number | undefined;
    caption?: string | undefined;
}, {
    type: "head_to_head";
    title: string;
    participants: {
        key: string;
        label: string;
    }[];
    matchups: {
        a: string;
        b: string;
        a_wins: number;
        b_wins: number;
        draws: number;
    }[];
} | {
    type: "compare";
    task: string;
    content: string;
    expected?: string | undefined;
    verdict?: string | undefined;
    score?: number | undefined;
} | {
    type: "transcript";
    title: string;
    turns: {
        content: string;
        role: string;
        status?: string | undefined;
    }[];
} | {
    type: "timeline";
    title: string;
    events: {
        label: string;
        t: string;
    }[];
    series?: {
        t: string;
        v: number;
    }[] | undefined;
} | {
    type: "image";
    src: string;
    score?: number | undefined;
    caption?: string | undefined;
}>;
export declare const ResultEntrySchema: z.ZodObject<{
    participant: z.ZodEffects<z.ZodObject<{
        model: z.ZodString;
        harness: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        harness_version: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        config: z.ZodOptional<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodUnknown>, Record<string, unknown>, Record<string, unknown>>>;
    }, "strip", z.ZodTypeAny, {
        model: string;
        harness?: string | undefined;
        harness_version?: string | undefined;
        config?: Record<string, unknown> | undefined;
    }, {
        model: string;
        harness?: string | undefined;
        harness_version?: string | undefined;
        config?: Record<string, unknown> | undefined;
    }>, {
        model: string;
        harness?: string | undefined;
        harness_version?: string | undefined;
        config?: Record<string, unknown> | undefined;
    }, {
        model: string;
        harness?: string | undefined;
        harness_version?: string | undefined;
        config?: Record<string, unknown> | undefined;
    }>;
    score: z.ZodNullable<z.ZodNumber>;
    raw_metric: z.ZodOptional<z.ZodObject<{
        label: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        label: string;
    }, {
        value: string;
        label: string;
    }>>;
    detail: z.ZodOptional<z.ZodString>;
    usage: z.ZodOptional<z.ZodObject<{
        tokens: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        tokens?: number | undefined;
    }, {
        tokens?: number | undefined;
    }>>;
    task_results: z.ZodOptional<z.ZodArray<z.ZodObject<{
        task_id: z.ZodString;
        score: z.ZodNumber;
        raw: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        score: number;
        task_id: string;
        raw?: string | undefined;
    }, {
        score: number;
        task_id: string;
        raw?: string | undefined;
    }>, "many">>;
    showcases: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"compare">;
        task: z.ZodString;
        content: z.ZodString;
        expected: z.ZodOptional<z.ZodString>;
        verdict: z.ZodOptional<z.ZodString>;
        score: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "compare";
        task: string;
        content: string;
        expected?: string | undefined;
        verdict?: string | undefined;
        score?: number | undefined;
    }, {
        type: "compare";
        task: string;
        content: string;
        expected?: string | undefined;
        verdict?: string | undefined;
        score?: number | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"transcript">;
        title: z.ZodString;
        turns: z.ZodArray<z.ZodObject<{
            role: z.ZodString;
            content: z.ZodString;
            status: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            content: string;
            role: string;
            status?: string | undefined;
        }, {
            content: string;
            role: string;
            status?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "transcript";
        title: string;
        turns: {
            content: string;
            role: string;
            status?: string | undefined;
        }[];
    }, {
        type: "transcript";
        title: string;
        turns: {
            content: string;
            role: string;
            status?: string | undefined;
        }[];
    }>, z.ZodObject<{
        type: z.ZodLiteral<"timeline">;
        title: z.ZodString;
        series: z.ZodOptional<z.ZodArray<z.ZodObject<{
            t: z.ZodString;
            v: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            t: string;
            v: number;
        }, {
            t: string;
            v: number;
        }>, "many">>;
        events: z.ZodArray<z.ZodObject<{
            t: z.ZodString;
            label: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            label: string;
            t: string;
        }, {
            label: string;
            t: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "timeline";
        title: string;
        events: {
            label: string;
            t: string;
        }[];
        series?: {
            t: string;
            v: number;
        }[] | undefined;
    }, {
        type: "timeline";
        title: string;
        events: {
            label: string;
            t: string;
        }[];
        series?: {
            t: string;
            v: number;
        }[] | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"image">;
        src: z.ZodString;
        caption: z.ZodOptional<z.ZodString>;
        score: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "image";
        src: string;
        score?: number | undefined;
        caption?: string | undefined;
    }, {
        type: "image";
        src: string;
        score?: number | undefined;
        caption?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"head_to_head">;
        title: z.ZodString;
        participants: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            key: string;
            label: string;
        }, {
            key: string;
            label: string;
        }>, "many">;
        matchups: z.ZodArray<z.ZodObject<{
            a: z.ZodString;
            b: z.ZodString;
            a_wins: z.ZodEffects<z.ZodNumber, number, number>;
            b_wins: z.ZodEffects<z.ZodNumber, number, number>;
            draws: z.ZodEffects<z.ZodNumber, number, number>;
        }, "strip", z.ZodTypeAny, {
            a: string;
            b: string;
            a_wins: number;
            b_wins: number;
            draws: number;
        }, {
            a: string;
            b: string;
            a_wins: number;
            b_wins: number;
            draws: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        type: "head_to_head";
        title: string;
        participants: {
            key: string;
            label: string;
        }[];
        matchups: {
            a: string;
            b: string;
            a_wins: number;
            b_wins: number;
            draws: number;
        }[];
    }, {
        type: "head_to_head";
        title: string;
        participants: {
            key: string;
            label: string;
        }[];
        matchups: {
            a: string;
            b: string;
            a_wins: number;
            b_wins: number;
            draws: number;
        }[];
    }>]>, {
        type: "head_to_head";
        title: string;
        participants: {
            key: string;
            label: string;
        }[];
        matchups: {
            a: string;
            b: string;
            a_wins: number;
            b_wins: number;
            draws: number;
        }[];
    } | {
        type: "compare";
        task: string;
        content: string;
        expected?: string | undefined;
        verdict?: string | undefined;
        score?: number | undefined;
    } | {
        type: "transcript";
        title: string;
        turns: {
            content: string;
            role: string;
            status?: string | undefined;
        }[];
    } | {
        type: "timeline";
        title: string;
        events: {
            label: string;
            t: string;
        }[];
        series?: {
            t: string;
            v: number;
        }[] | undefined;
    } | {
        type: "image";
        src: string;
        score?: number | undefined;
        caption?: string | undefined;
    }, {
        type: "head_to_head";
        title: string;
        participants: {
            key: string;
            label: string;
        }[];
        matchups: {
            a: string;
            b: string;
            a_wins: number;
            b_wins: number;
            draws: number;
        }[];
    } | {
        type: "compare";
        task: string;
        content: string;
        expected?: string | undefined;
        verdict?: string | undefined;
        score?: number | undefined;
    } | {
        type: "transcript";
        title: string;
        turns: {
            content: string;
            role: string;
            status?: string | undefined;
        }[];
    } | {
        type: "timeline";
        title: string;
        events: {
            label: string;
            t: string;
        }[];
        series?: {
            t: string;
            v: number;
        }[] | undefined;
    } | {
        type: "image";
        src: string;
        score?: number | undefined;
        caption?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    participant: {
        model: string;
        harness?: string | undefined;
        harness_version?: string | undefined;
        config?: Record<string, unknown> | undefined;
    };
    score: number | null;
    raw_metric?: {
        value: string;
        label: string;
    } | undefined;
    detail?: string | undefined;
    usage?: {
        tokens?: number | undefined;
    } | undefined;
    task_results?: {
        score: number;
        task_id: string;
        raw?: string | undefined;
    }[] | undefined;
    showcases?: ({
        type: "head_to_head";
        title: string;
        participants: {
            key: string;
            label: string;
        }[];
        matchups: {
            a: string;
            b: string;
            a_wins: number;
            b_wins: number;
            draws: number;
        }[];
    } | {
        type: "compare";
        task: string;
        content: string;
        expected?: string | undefined;
        verdict?: string | undefined;
        score?: number | undefined;
    } | {
        type: "transcript";
        title: string;
        turns: {
            content: string;
            role: string;
            status?: string | undefined;
        }[];
    } | {
        type: "timeline";
        title: string;
        events: {
            label: string;
            t: string;
        }[];
        series?: {
            t: string;
            v: number;
        }[] | undefined;
    } | {
        type: "image";
        src: string;
        score?: number | undefined;
        caption?: string | undefined;
    })[] | undefined;
}, {
    participant: {
        model: string;
        harness?: string | undefined;
        harness_version?: string | undefined;
        config?: Record<string, unknown> | undefined;
    };
    score: number | null;
    raw_metric?: {
        value: string;
        label: string;
    } | undefined;
    detail?: string | undefined;
    usage?: {
        tokens?: number | undefined;
    } | undefined;
    task_results?: {
        score: number;
        task_id: string;
        raw?: string | undefined;
    }[] | undefined;
    showcases?: ({
        type: "head_to_head";
        title: string;
        participants: {
            key: string;
            label: string;
        }[];
        matchups: {
            a: string;
            b: string;
            a_wins: number;
            b_wins: number;
            draws: number;
        }[];
    } | {
        type: "compare";
        task: string;
        content: string;
        expected?: string | undefined;
        verdict?: string | undefined;
        score?: number | undefined;
    } | {
        type: "transcript";
        title: string;
        turns: {
            content: string;
            role: string;
            status?: string | undefined;
        }[];
    } | {
        type: "timeline";
        title: string;
        events: {
            label: string;
            t: string;
        }[];
        series?: {
            t: string;
            v: number;
        }[] | undefined;
    } | {
        type: "image";
        src: string;
        score?: number | undefined;
        caption?: string | undefined;
    })[] | undefined;
}>;
export declare const ResultFileSchema: z.ZodObject<{
    eval_id: z.ZodString;
    eval_commit: z.ZodOptional<z.ZodString>;
    submission: z.ZodObject<{
        runner_version: z.ZodString;
        run_date: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        runner_version: string;
        run_date: string;
    }, {
        runner_version: string;
        run_date: string;
    }>;
    results: z.ZodArray<z.ZodObject<{
        participant: z.ZodEffects<z.ZodObject<{
            model: z.ZodString;
            harness: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
            harness_version: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
            config: z.ZodOptional<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodUnknown>, Record<string, unknown>, Record<string, unknown>>>;
        }, "strip", z.ZodTypeAny, {
            model: string;
            harness?: string | undefined;
            harness_version?: string | undefined;
            config?: Record<string, unknown> | undefined;
        }, {
            model: string;
            harness?: string | undefined;
            harness_version?: string | undefined;
            config?: Record<string, unknown> | undefined;
        }>, {
            model: string;
            harness?: string | undefined;
            harness_version?: string | undefined;
            config?: Record<string, unknown> | undefined;
        }, {
            model: string;
            harness?: string | undefined;
            harness_version?: string | undefined;
            config?: Record<string, unknown> | undefined;
        }>;
        score: z.ZodNullable<z.ZodNumber>;
        raw_metric: z.ZodOptional<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            value: string;
            label: string;
        }, {
            value: string;
            label: string;
        }>>;
        detail: z.ZodOptional<z.ZodString>;
        usage: z.ZodOptional<z.ZodObject<{
            tokens: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            tokens?: number | undefined;
        }, {
            tokens?: number | undefined;
        }>>;
        task_results: z.ZodOptional<z.ZodArray<z.ZodObject<{
            task_id: z.ZodString;
            score: z.ZodNumber;
            raw: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            score: number;
            task_id: string;
            raw?: string | undefined;
        }, {
            score: number;
            task_id: string;
            raw?: string | undefined;
        }>, "many">>;
        showcases: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"compare">;
            task: z.ZodString;
            content: z.ZodString;
            expected: z.ZodOptional<z.ZodString>;
            verdict: z.ZodOptional<z.ZodString>;
            score: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            type: "compare";
            task: string;
            content: string;
            expected?: string | undefined;
            verdict?: string | undefined;
            score?: number | undefined;
        }, {
            type: "compare";
            task: string;
            content: string;
            expected?: string | undefined;
            verdict?: string | undefined;
            score?: number | undefined;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"transcript">;
            title: z.ZodString;
            turns: z.ZodArray<z.ZodObject<{
                role: z.ZodString;
                content: z.ZodString;
                status: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                content: string;
                role: string;
                status?: string | undefined;
            }, {
                content: string;
                role: string;
                status?: string | undefined;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "transcript";
            title: string;
            turns: {
                content: string;
                role: string;
                status?: string | undefined;
            }[];
        }, {
            type: "transcript";
            title: string;
            turns: {
                content: string;
                role: string;
                status?: string | undefined;
            }[];
        }>, z.ZodObject<{
            type: z.ZodLiteral<"timeline">;
            title: z.ZodString;
            series: z.ZodOptional<z.ZodArray<z.ZodObject<{
                t: z.ZodString;
                v: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                t: string;
                v: number;
            }, {
                t: string;
                v: number;
            }>, "many">>;
            events: z.ZodArray<z.ZodObject<{
                t: z.ZodString;
                label: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                label: string;
                t: string;
            }, {
                label: string;
                t: string;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "timeline";
            title: string;
            events: {
                label: string;
                t: string;
            }[];
            series?: {
                t: string;
                v: number;
            }[] | undefined;
        }, {
            type: "timeline";
            title: string;
            events: {
                label: string;
                t: string;
            }[];
            series?: {
                t: string;
                v: number;
            }[] | undefined;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"image">;
            src: z.ZodString;
            caption: z.ZodOptional<z.ZodString>;
            score: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            type: "image";
            src: string;
            score?: number | undefined;
            caption?: string | undefined;
        }, {
            type: "image";
            src: string;
            score?: number | undefined;
            caption?: string | undefined;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"head_to_head">;
            title: z.ZodString;
            participants: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                label: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                key: string;
                label: string;
            }, {
                key: string;
                label: string;
            }>, "many">;
            matchups: z.ZodArray<z.ZodObject<{
                a: z.ZodString;
                b: z.ZodString;
                a_wins: z.ZodEffects<z.ZodNumber, number, number>;
                b_wins: z.ZodEffects<z.ZodNumber, number, number>;
                draws: z.ZodEffects<z.ZodNumber, number, number>;
            }, "strip", z.ZodTypeAny, {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }, {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            type: "head_to_head";
            title: string;
            participants: {
                key: string;
                label: string;
            }[];
            matchups: {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }[];
        }, {
            type: "head_to_head";
            title: string;
            participants: {
                key: string;
                label: string;
            }[];
            matchups: {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }[];
        }>]>, {
            type: "head_to_head";
            title: string;
            participants: {
                key: string;
                label: string;
            }[];
            matchups: {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }[];
        } | {
            type: "compare";
            task: string;
            content: string;
            expected?: string | undefined;
            verdict?: string | undefined;
            score?: number | undefined;
        } | {
            type: "transcript";
            title: string;
            turns: {
                content: string;
                role: string;
                status?: string | undefined;
            }[];
        } | {
            type: "timeline";
            title: string;
            events: {
                label: string;
                t: string;
            }[];
            series?: {
                t: string;
                v: number;
            }[] | undefined;
        } | {
            type: "image";
            src: string;
            score?: number | undefined;
            caption?: string | undefined;
        }, {
            type: "head_to_head";
            title: string;
            participants: {
                key: string;
                label: string;
            }[];
            matchups: {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }[];
        } | {
            type: "compare";
            task: string;
            content: string;
            expected?: string | undefined;
            verdict?: string | undefined;
            score?: number | undefined;
        } | {
            type: "transcript";
            title: string;
            turns: {
                content: string;
                role: string;
                status?: string | undefined;
            }[];
        } | {
            type: "timeline";
            title: string;
            events: {
                label: string;
                t: string;
            }[];
            series?: {
                t: string;
                v: number;
            }[] | undefined;
        } | {
            type: "image";
            src: string;
            score?: number | undefined;
            caption?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        participant: {
            model: string;
            harness?: string | undefined;
            harness_version?: string | undefined;
            config?: Record<string, unknown> | undefined;
        };
        score: number | null;
        raw_metric?: {
            value: string;
            label: string;
        } | undefined;
        detail?: string | undefined;
        usage?: {
            tokens?: number | undefined;
        } | undefined;
        task_results?: {
            score: number;
            task_id: string;
            raw?: string | undefined;
        }[] | undefined;
        showcases?: ({
            type: "head_to_head";
            title: string;
            participants: {
                key: string;
                label: string;
            }[];
            matchups: {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }[];
        } | {
            type: "compare";
            task: string;
            content: string;
            expected?: string | undefined;
            verdict?: string | undefined;
            score?: number | undefined;
        } | {
            type: "transcript";
            title: string;
            turns: {
                content: string;
                role: string;
                status?: string | undefined;
            }[];
        } | {
            type: "timeline";
            title: string;
            events: {
                label: string;
                t: string;
            }[];
            series?: {
                t: string;
                v: number;
            }[] | undefined;
        } | {
            type: "image";
            src: string;
            score?: number | undefined;
            caption?: string | undefined;
        })[] | undefined;
    }, {
        participant: {
            model: string;
            harness?: string | undefined;
            harness_version?: string | undefined;
            config?: Record<string, unknown> | undefined;
        };
        score: number | null;
        raw_metric?: {
            value: string;
            label: string;
        } | undefined;
        detail?: string | undefined;
        usage?: {
            tokens?: number | undefined;
        } | undefined;
        task_results?: {
            score: number;
            task_id: string;
            raw?: string | undefined;
        }[] | undefined;
        showcases?: ({
            type: "head_to_head";
            title: string;
            participants: {
                key: string;
                label: string;
            }[];
            matchups: {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }[];
        } | {
            type: "compare";
            task: string;
            content: string;
            expected?: string | undefined;
            verdict?: string | undefined;
            score?: number | undefined;
        } | {
            type: "transcript";
            title: string;
            turns: {
                content: string;
                role: string;
                status?: string | undefined;
            }[];
        } | {
            type: "timeline";
            title: string;
            events: {
                label: string;
                t: string;
            }[];
            series?: {
                t: string;
                v: number;
            }[] | undefined;
        } | {
            type: "image";
            src: string;
            score?: number | undefined;
            caption?: string | undefined;
        })[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    eval_id: string;
    submission: {
        runner_version: string;
        run_date: string;
    };
    results: {
        participant: {
            model: string;
            harness?: string | undefined;
            harness_version?: string | undefined;
            config?: Record<string, unknown> | undefined;
        };
        score: number | null;
        raw_metric?: {
            value: string;
            label: string;
        } | undefined;
        detail?: string | undefined;
        usage?: {
            tokens?: number | undefined;
        } | undefined;
        task_results?: {
            score: number;
            task_id: string;
            raw?: string | undefined;
        }[] | undefined;
        showcases?: ({
            type: "head_to_head";
            title: string;
            participants: {
                key: string;
                label: string;
            }[];
            matchups: {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }[];
        } | {
            type: "compare";
            task: string;
            content: string;
            expected?: string | undefined;
            verdict?: string | undefined;
            score?: number | undefined;
        } | {
            type: "transcript";
            title: string;
            turns: {
                content: string;
                role: string;
                status?: string | undefined;
            }[];
        } | {
            type: "timeline";
            title: string;
            events: {
                label: string;
                t: string;
            }[];
            series?: {
                t: string;
                v: number;
            }[] | undefined;
        } | {
            type: "image";
            src: string;
            score?: number | undefined;
            caption?: string | undefined;
        })[] | undefined;
    }[];
    eval_commit?: string | undefined;
}, {
    eval_id: string;
    submission: {
        runner_version: string;
        run_date: string;
    };
    results: {
        participant: {
            model: string;
            harness?: string | undefined;
            harness_version?: string | undefined;
            config?: Record<string, unknown> | undefined;
        };
        score: number | null;
        raw_metric?: {
            value: string;
            label: string;
        } | undefined;
        detail?: string | undefined;
        usage?: {
            tokens?: number | undefined;
        } | undefined;
        task_results?: {
            score: number;
            task_id: string;
            raw?: string | undefined;
        }[] | undefined;
        showcases?: ({
            type: "head_to_head";
            title: string;
            participants: {
                key: string;
                label: string;
            }[];
            matchups: {
                a: string;
                b: string;
                a_wins: number;
                b_wins: number;
                draws: number;
            }[];
        } | {
            type: "compare";
            task: string;
            content: string;
            expected?: string | undefined;
            verdict?: string | undefined;
            score?: number | undefined;
        } | {
            type: "transcript";
            title: string;
            turns: {
                content: string;
                role: string;
                status?: string | undefined;
            }[];
        } | {
            type: "timeline";
            title: string;
            events: {
                label: string;
                t: string;
            }[];
            series?: {
                t: string;
                v: number;
            }[] | undefined;
        } | {
            type: "image";
            src: string;
            score?: number | undefined;
            caption?: string | undefined;
        })[] | undefined;
    }[];
    eval_commit?: string | undefined;
}>;
export type Showcase = z.infer<typeof ShowcaseSchema>;
export type HeadToHeadParticipant = HeadToHeadShowcaseValue["participants"][number];
export type HeadToHeadMatchup = HeadToHeadShowcaseValue["matchups"][number];
export type HeadToHeadShowcase = z.infer<typeof HeadToHeadShowcaseSchema>;
export type ResultEntry = z.infer<typeof ResultEntrySchema>;
export type ResultFile = z.infer<typeof ResultFileSchema>;
export {};
