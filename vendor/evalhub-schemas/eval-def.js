import { z } from "zod";
const commandTemplateKeys = new Set(["argv", "output"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const MAX_COMMAND_ARGV_TOKENS = 64;
const MAX_COMMAND_ARGV_TOKEN_LENGTH = 4096;
const MAX_COMMAND_OUTPUT_LENGTH = 1024;
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
const evalDefShape = {
    id: EvalIdSchema,
    hackathon_id: EvalIdSchema.optional(),
    name: z.string().min(1),
    category: z.enum(["fun", "useful"]),
    description: z.string().min(1),
    hook_title: z.string().optional(),
    dimensions: z
        .array(z.enum(["幽默", "语言", "推理", "代码", "博弈", "经营"]))
        .min(1)
        .max(2),
    interface: z.enum(["chat", "dialogue", "agent"]),
    runner: z.enum(["builtin", "custom"]),
    scoring: z.enum(["exact", "judge", "custom"]),
    scored_by: z.enum(["local", "author"]),
    score_unit: z.string().default("分"),
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
    if (v.scoring === "judge" && !v.judge_model) {
        ctx.addIssue({ code: "custom", message: "scoring=judge 必须钉死 judge_model" });
    }
    if (v.scored_by === "author" && !v.scoring_note) {
        ctx.addIssue({
            code: "custom",
            message: "scored_by=author 必须提供 scoring_note 判分公示文",
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
    .superRefine((value, ctx) => refineEvalDef(value, ctx, true));
export const StoredEvalDefSchema = z
    .object({
    ...evalDefShape,
    command_template: CommandTemplateSchema.nullish(),
})
    .superRefine((value, ctx) => refineEvalDef(value, ctx, false));
