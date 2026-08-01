import { z } from "zod";
const commandTemplateKeys = new Set(["argv", "output"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const MAX_COMMAND_ARGV_TOKENS = 64;
const MAX_COMMAND_ARGV_TOKEN_LENGTH = 4096;
const MAX_COMMAND_OUTPUT_LENGTH = 1024;
const MAX_EVAL_REFERENCE_URL_LENGTH = 2048;
export const EvalIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/);
const CommandArgvTokenSchema = z
    .string()
    .min(1, "command_template.argv token 不能为空")
    .max(MAX_COMMAND_ARGV_TOKEN_LENGTH, `command_template.argv token 最长 ${MAX_COMMAND_ARGV_TOKEN_LENGTH} 字符`)
    .refine((value) => !CONTROL_CHARACTERS.test(value), {
    message: "command_template.argv token 不能包含控制字符",
});
function isSafeRelativeOutput(value) {
    if (value.startsWith("-") ||
        /^[\\/]/u.test(value) ||
        /^[A-Za-z]:/u.test(value)) {
        return false;
    }
    const segments = value.split(/[\\/]/u);
    const lastSegment = segments[segments.length - 1];
    return (!segments.includes("..") && lastSegment !== "" && lastSegment !== ".");
}
export const CommandOutputSchema = z
    .string()
    .max(MAX_COMMAND_OUTPUT_LENGTH, `command_template.output 最长 ${MAX_COMMAND_OUTPUT_LENGTH} 字符`)
    .refine((value) => value.trim().length > 0, {
    message: "command_template.output 不能为空",
})
    .refine((value) => !CONTROL_CHARACTERS.test(value), {
    message: "command_template.output 不能包含控制字符",
})
    .refine(isSafeRelativeOutput, {
    message: "command_template.output 必须是安全的相对路径",
});
export const CommandOutputOverrideSchema = z
    .string()
    .max(MAX_COMMAND_OUTPUT_LENGTH, `output override 最长 ${MAX_COMMAND_OUTPUT_LENGTH} 字符`)
    .refine((value) => value.trim().length > 0, {
    message: "output override 不能为空",
})
    .refine((value) => !CONTROL_CHARACTERS.test(value), {
    message: "output override 不能包含控制字符",
})
    .refine((value) => !value.startsWith("-"), {
    message: "output override 不能以 - 开头",
});
export const CommandTemplateSchema = z
    .object({
    argv: z
        .array(CommandArgvTokenSchema)
        .min(1, "command_template.argv 不能为空")
        .max(MAX_COMMAND_ARGV_TOKENS, `command_template.argv 最多 ${MAX_COMMAND_ARGV_TOKENS} 个 token`),
    output: CommandOutputSchema,
})
    .passthrough()
    .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
        if (!commandTemplateKeys.has(key)) {
            ctx.addIssue({
                code: "custom",
                path: [key],
                message: `command_template 不支持字段 ${key}`,
            });
        }
    }
    let outputPlaceholders = 0;
    for (const [index, arg] of value.argv.entries()) {
        if (index === 0 && arg.trim().length === 0) {
            ctx.addIssue({
                code: "custom",
                path: ["argv", index],
                message: "command_template.argv[0] 必须是有效的 executable token",
            });
        }
        if (arg === "{output}") {
            outputPlaceholders += 1;
            if (index === 0) {
                ctx.addIssue({
                    code: "custom",
                    path: ["argv", index],
                    message: "command_template.argv[0] 必须是 executable，不能是 {output}",
                });
            }
            continue;
        }
        if (arg.includes("{output}")) {
            ctx.addIssue({
                code: "custom",
                path: ["argv", index],
                message: "{output} 必须是独立的 argv token",
            });
        }
        const unknownPlaceholders = arg.match(/\{[^{}]+\}/g) ?? [];
        for (const placeholder of unknownPlaceholders) {
            if (placeholder !== "{output}") {
                ctx.addIssue({
                    code: "custom",
                    path: ["argv", index],
                    message: `command_template 不支持占位符 ${placeholder}`,
                });
            }
        }
        const placeholderRemainder = arg.replace(/\{[^{}]+\}/g, "");
        if (/[{}]/u.test(placeholderRemainder)) {
            ctx.addIssue({
                code: "custom",
                path: ["argv", index],
                message: "command_template.argv token 包含无效占位符",
            });
        }
    }
    if (outputPlaceholders !== 1) {
        ctx.addIssue({
            code: "custom",
            path: ["argv"],
            message: "command_template.argv 必须且只能包含一个独立 {output} token",
        });
    }
})
    .transform(({ argv, output }) => ({ argv, output }));
/**
 * 评测集级同分 tiebreak 声明（可选）：同分（score 相等）时按 result raw_metric JSON 里
 * `metric` 指定的数值键排序，方向由 `order` 决定，`label` 供展示（如「存活天数」）。
 * 缺省时排名行为与历史完全一致（score desc 单键 + 稳定身份 tiebreak）。
 */
export const EvalTiebreakSchema = z.object({
    metric: z
        .string()
        .refine((value) => value.trim().length > 0, {
        message: "tiebreak.metric 不能为空",
    }),
    order: z.enum(["desc", "asc"]),
    label: z
        .string()
        .refine((value) => value.trim().length > 0, {
        message: "tiebreak.label 不能为空",
    }),
});
function isSafeHttpsReferenceUrl(value) {
    if (value !== value.trim() || CONTROL_CHARACTERS.test(value)) {
        return false;
    }
    try {
        const url = new URL(value);
        return (url.protocol === "https:" &&
            url.hostname.length > 0 &&
            url.username.length === 0 &&
            url.password.length === 0);
    }
    catch {
        return false;
    }
}
const EvalReferenceUrlSchema = z
    .string()
    .max(MAX_EVAL_REFERENCE_URL_LENGTH, `references URL 最长 ${MAX_EVAL_REFERENCE_URL_LENGTH} 字符`)
    .refine(isSafeHttpsReferenceUrl, {
    message: "references URL 必须是无凭证的 HTTPS 链接",
});
/**
 * 评测集的第一方外部资料。EvalHub 自身的源码目录链接由平台根据 repoPath 生成，
 * 不在这里重复声明；repository 指被接入项目的上游作者仓库。
 */
export const EvalReferencesSchema = z
    .object({
    homepage: EvalReferenceUrlSchema.optional(),
    paper: EvalReferenceUrlSchema.optional(),
    repository: EvalReferenceUrlSchema.optional(),
})
    .strict()
    .refine((value) => value.homepage !== undefined ||
    value.paper !== undefined ||
    value.repository !== undefined, {
    message: "references 至少提供 homepage、paper、repository 中的一项",
});
const evalDefShape = {
    id: EvalIdSchema,
    hackathon_id: EvalIdSchema.optional(),
    name: z.string().min(1),
    category: z.enum(["fun", "useful"]),
    // 展示类目（可选，作者显式声明）；缺省时平台按 interface/category 启发式推导
    display_category: z.enum(["agent", "reason", "vision", "fun"]).optional(),
    description: z.string().min(1),
    hook_title: z.string().optional(),
    references: EvalReferencesSchema.optional(),
    dimensions: z
        .array(z.enum(["幽默", "语言", "推理", "代码", "博弈", "经营"]))
        .min(1)
        .max(2),
    interface: z.enum(["chat", "dialogue", "agent"]),
    runner: z.enum(["builtin", "custom"]),
    scoring: z.enum(["exact", "judge", "custom"]),
    scored_by: z.enum(["local", "author"]),
    // 是否允许先交原始产物、后由作者补分。省略时保持历史兼容：author => author_fill，
    // local => required；新评测应显式声明，避免把「作者认可」误当成「允许空分」。
    score_policy: z.enum(["required", "author_fill"]).optional(),
    // required 表示该评测版本必须随仓库提交至少一条可公开、可复核的官方/基线成绩。
    baseline_policy: z.enum(["optional", "required"]).default("optional"),
    score_unit: z.string().default("分"),
    // rating 榜从所有已验证 team_games 历史事实重算；缺省保持旧的最新 session 排榜。
    leaderboard: z.enum(["latest_session", "rating"]).default("latest_session"),
    // 同分 tiebreak 声明（可选，向后兼容：缺省时排名行为不变）
    tiebreak: EvalTiebreakSchema.optional(),
    judge_model: z.string().optional(),
    judge_rubric: z.string().optional(),
    scoring_note: z.string().optional(),
    trials: z.number().int().min(1).default(1),
    est_tokens: z.number().int().positive().optional(),
    tasks: z
        .array(z.object({
        id: z.string().optional(),
        prompt: z.string().min(1),
        expected: z.string().optional(),
    }))
        .min(1),
};
function refineEvalDef(value, ctx, requireCustomCommandTemplate) {
    const v = value;
    if (v.leaderboard === "rating" && v.interface !== "dialogue") {
        ctx.addIssue({
            code: "custom",
            path: ["leaderboard"],
            message: "leaderboard=rating 仅支持 interface=dialogue",
        });
    }
    if (v.scoring === "judge" && !v.judge_model) {
        ctx.addIssue({ code: "custom", message: "scoring=judge 必须钉死 judge_model" });
    }
    if (v.scored_by === "author" && !v.scoring_note) {
        ctx.addIssue({
            code: "custom",
            message: "scored_by=author 必须提供 scoring_note 判分公示文",
        });
    }
    if (v.score_policy === "author_fill" && v.scored_by !== "author") {
        ctx.addIssue({
            code: "custom",
            path: ["score_policy"],
            message: "score_policy=author_fill 仅支持 scored_by=author",
        });
    }
    if (requireCustomCommandTemplate &&
        v.runner === "custom" &&
        !v.command_template) {
        ctx.addIssue({
            code: "custom",
            path: ["command_template"],
            message: "runner=custom 必须提供 command_template",
        });
    }
    if (v.runner === "builtin" && v.command_template) {
        ctx.addIssue({
            code: "custom",
            path: ["command_template"],
            message: "runner=builtin 不能提供 command_template",
        });
    }
}
export const EvalDefSchema = z
    .object({
    ...evalDefShape,
    command_template: CommandTemplateSchema.optional(),
})
    .superRefine((value, ctx) => refineEvalDef(value, ctx, true))
    .transform((value) => ({
    ...value,
    score_policy: resolveScorePolicy(value),
}));
export const StoredEvalDefSchema = z
    .object({
    ...evalDefShape,
    command_template: CommandTemplateSchema.nullish(),
})
    .superRefine((value, ctx) => refineEvalDef(value, ctx, false))
    .transform((value) => ({
    ...value,
    score_policy: resolveScorePolicy(value),
}));
export function resolveScorePolicy(value) {
    return value.score_policy ?? (value.scored_by === "author" ? "author_fill" : "required");
}
