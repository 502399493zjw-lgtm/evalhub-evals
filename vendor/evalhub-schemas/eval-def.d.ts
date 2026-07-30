import { z } from "zod";
export declare const EvalIdSchema: z.ZodString;
export declare const CommandOutputSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
export declare const CommandOutputOverrideSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
export declare const CommandTemplateSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, z.ZodTypeAny, "passthrough">>, z.objectOutputType<{
    argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, z.ZodTypeAny, "passthrough">>, {
    argv: string[];
    output: string;
}, z.objectInputType<{
    argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
}, z.ZodTypeAny, "passthrough">>;
export type CommandTemplate = z.infer<typeof CommandTemplateSchema>;
/**
 * 评测集级同分 tiebreak 声明（可选）：同分（score 相等）时按 result raw_metric JSON 里
 * `metric` 指定的数值键排序，方向由 `order` 决定，`label` 供展示（如「存活天数」）。
 * 缺省时排名行为与历史完全一致（score desc 单键 + 稳定身份 tiebreak）。
 */
export declare const EvalTiebreakSchema: z.ZodObject<{
    metric: z.ZodEffects<z.ZodString, string, string>;
    order: z.ZodEnum<["desc", "asc"]>;
    label: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    metric: string;
    order: "desc" | "asc";
    label: string;
}, {
    metric: string;
    order: "desc" | "asc";
    label: string;
}>;
export type EvalTiebreak = z.infer<typeof EvalTiebreakSchema>;
export declare const EvalDefSchema: z.ZodEffects<z.ZodObject<{
    command_template: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodObject<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">>, z.objectOutputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">>, {
        argv: string[];
        output: string;
    }, z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">>>;
    id: z.ZodString;
    hackathon_id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    category: z.ZodEnum<["fun", "useful"]>;
    display_category: z.ZodOptional<z.ZodEnum<["agent", "reason", "vision", "fun"]>>;
    description: z.ZodString;
    hook_title: z.ZodOptional<z.ZodString>;
    dimensions: z.ZodArray<z.ZodEnum<["幽默", "语言", "推理", "代码", "博弈", "经营"]>, "many">;
    interface: z.ZodEnum<["chat", "dialogue", "agent"]>;
    runner: z.ZodEnum<["builtin", "custom"]>;
    scoring: z.ZodEnum<["exact", "judge", "custom"]>;
    scored_by: z.ZodEnum<["local", "author"]>;
    score_unit: z.ZodDefault<z.ZodString>;
    leaderboard: z.ZodDefault<z.ZodEnum<["latest_session", "rating"]>>;
    tiebreak: z.ZodOptional<z.ZodObject<{
        metric: z.ZodEffects<z.ZodString, string, string>;
        order: z.ZodEnum<["desc", "asc"]>;
        label: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        metric: string;
        order: "desc" | "asc";
        label: string;
    }, {
        metric: string;
        order: "desc" | "asc";
        label: string;
    }>>;
    judge_model: z.ZodOptional<z.ZodString>;
    judge_rubric: z.ZodOptional<z.ZodString>;
    scoring_note: z.ZodOptional<z.ZodString>;
    trials: z.ZodDefault<z.ZodNumber>;
    est_tokens: z.ZodOptional<z.ZodNumber>;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        prompt: z.ZodString;
        expected: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }, {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    leaderboard: "latest_session" | "rating";
    name: string;
    category: "fun" | "useful";
    description: string;
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "agent" | "chat" | "dialogue";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    scored_by: "local" | "author";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }[];
    command_template?: {
        argv: string[];
        output: string;
    } | undefined;
    hackathon_id?: string | undefined;
    display_category?: "fun" | "agent" | "reason" | "vision" | undefined;
    hook_title?: string | undefined;
    tiebreak?: {
        metric: string;
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    id: string;
    name: string;
    category: "fun" | "useful";
    description: string;
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "agent" | "chat" | "dialogue";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    scored_by: "local" | "author";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    hackathon_id?: string | undefined;
    display_category?: "fun" | "agent" | "reason" | "vision" | undefined;
    hook_title?: string | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: string;
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    trials?: number | undefined;
    est_tokens?: number | undefined;
}>, {
    id: string;
    leaderboard: "latest_session" | "rating";
    name: string;
    category: "fun" | "useful";
    description: string;
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "agent" | "chat" | "dialogue";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    scored_by: "local" | "author";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }[];
    command_template?: {
        argv: string[];
        output: string;
    } | undefined;
    hackathon_id?: string | undefined;
    display_category?: "fun" | "agent" | "reason" | "vision" | undefined;
    hook_title?: string | undefined;
    tiebreak?: {
        metric: string;
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    id: string;
    name: string;
    category: "fun" | "useful";
    description: string;
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "agent" | "chat" | "dialogue";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    scored_by: "local" | "author";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    hackathon_id?: string | undefined;
    display_category?: "fun" | "agent" | "reason" | "vision" | undefined;
    hook_title?: string | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: string;
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    trials?: number | undefined;
    est_tokens?: number | undefined;
}>;
export type EvalDef = z.infer<typeof EvalDefSchema>;
export declare const StoredEvalDefSchema: z.ZodEffects<z.ZodObject<{
    command_template: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodEffects<z.ZodObject<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">>, z.objectOutputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">>, {
        argv: string[];
        output: string;
    }, z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough">>>>;
    id: z.ZodString;
    hackathon_id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    category: z.ZodEnum<["fun", "useful"]>;
    display_category: z.ZodOptional<z.ZodEnum<["agent", "reason", "vision", "fun"]>>;
    description: z.ZodString;
    hook_title: z.ZodOptional<z.ZodString>;
    dimensions: z.ZodArray<z.ZodEnum<["幽默", "语言", "推理", "代码", "博弈", "经营"]>, "many">;
    interface: z.ZodEnum<["chat", "dialogue", "agent"]>;
    runner: z.ZodEnum<["builtin", "custom"]>;
    scoring: z.ZodEnum<["exact", "judge", "custom"]>;
    scored_by: z.ZodEnum<["local", "author"]>;
    score_unit: z.ZodDefault<z.ZodString>;
    leaderboard: z.ZodDefault<z.ZodEnum<["latest_session", "rating"]>>;
    tiebreak: z.ZodOptional<z.ZodObject<{
        metric: z.ZodEffects<z.ZodString, string, string>;
        order: z.ZodEnum<["desc", "asc"]>;
        label: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        metric: string;
        order: "desc" | "asc";
        label: string;
    }, {
        metric: string;
        order: "desc" | "asc";
        label: string;
    }>>;
    judge_model: z.ZodOptional<z.ZodString>;
    judge_rubric: z.ZodOptional<z.ZodString>;
    scoring_note: z.ZodOptional<z.ZodString>;
    trials: z.ZodDefault<z.ZodNumber>;
    est_tokens: z.ZodOptional<z.ZodNumber>;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        prompt: z.ZodString;
        expected: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }, {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    leaderboard: "latest_session" | "rating";
    name: string;
    category: "fun" | "useful";
    description: string;
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "agent" | "chat" | "dialogue";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    scored_by: "local" | "author";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }[];
    command_template?: {
        argv: string[];
        output: string;
    } | null | undefined;
    hackathon_id?: string | undefined;
    display_category?: "fun" | "agent" | "reason" | "vision" | undefined;
    hook_title?: string | undefined;
    tiebreak?: {
        metric: string;
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    id: string;
    name: string;
    category: "fun" | "useful";
    description: string;
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "agent" | "chat" | "dialogue";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    scored_by: "local" | "author";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | null | undefined;
    hackathon_id?: string | undefined;
    display_category?: "fun" | "agent" | "reason" | "vision" | undefined;
    hook_title?: string | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: string;
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    trials?: number | undefined;
    est_tokens?: number | undefined;
}>, {
    id: string;
    leaderboard: "latest_session" | "rating";
    name: string;
    category: "fun" | "useful";
    description: string;
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "agent" | "chat" | "dialogue";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    scored_by: "local" | "author";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }[];
    command_template?: {
        argv: string[];
        output: string;
    } | null | undefined;
    hackathon_id?: string | undefined;
    display_category?: "fun" | "agent" | "reason" | "vision" | undefined;
    hook_title?: string | undefined;
    tiebreak?: {
        metric: string;
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    id: string;
    name: string;
    category: "fun" | "useful";
    description: string;
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "agent" | "chat" | "dialogue";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    scored_by: "local" | "author";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        id?: string | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | null | undefined;
    hackathon_id?: string | undefined;
    display_category?: "fun" | "agent" | "reason" | "vision" | undefined;
    hook_title?: string | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: string;
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    trials?: number | undefined;
    est_tokens?: number | undefined;
}>;
export type StoredEvalDef = z.infer<typeof StoredEvalDefSchema>;
