import { z } from "zod";
const commandTemplateKeys = new Set(["argv", "output"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const MAX_COMMAND_ARGV_TOKENS = 64;
const MAX_COMMAND_ARGV_TOKEN_LENGTH = 4096;
const MAX_COMMAND_OUTPUT_LENGTH = 1024;
const MAX_COMMAND_INPUT_LENGTH = 4096;
const MAX_EVAL_REFERENCE_URL_LENGTH = 2048;
const MAX_TASK_LABEL_LENGTH = 80;
const MAX_TASK_TRANSLATION_LENGTH = 30000;
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
export const CommandInputOverrideSchema = z
    .string()
    .max(MAX_COMMAND_INPUT_LENGTH, `input override 最长 ${MAX_COMMAND_INPUT_LENGTH} 字符`)
    .refine((value) => value.trim().length > 0, {
    message: "input override 不能为空",
})
    .refine((value) => !CONTROL_CHARACTERS.test(value), {
    message: "input override 不能包含控制字符",
})
    .refine((value) => !value.startsWith("-"), {
    message: "input override 不能以 - 开头",
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
    let inputPlaceholders = 0;
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
        if (arg === "{input}") {
            inputPlaceholders += 1;
            if (index === 0) {
                ctx.addIssue({
                    code: "custom",
                    path: ["argv", index],
                    message: "command_template.argv[0] 必须是 executable，不能是 {input}",
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
        if (arg.includes("{input}")) {
            ctx.addIssue({
                code: "custom",
                path: ["argv", index],
                message: "{input} 必须是独立的 argv token",
            });
        }
        const unknownPlaceholders = arg.match(/\{[^{}]+\}/g) ?? [];
        for (const placeholder of unknownPlaceholders) {
            if (placeholder !== "{output}" && placeholder !== "{input}") {
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
    if (inputPlaceholders > 1) {
        ctx.addIssue({
            code: "custom",
            path: ["argv"],
            message: "command_template.argv 最多包含一个独立 {input} token",
        });
    }
})
    .transform(({ argv, output }) => ({ argv, output }));
export const CustomRunnerModeSchema = z.enum([
    "executable",
    "external_workflow",
]);
/**
 * 评测集级同分 tiebreak 声明（可选）：同分（score 相等）时按 result
 * `raw_metric.tiebreak_value` 的有限数值排序，方向由 `order` 决定，`label`
 * 供展示（如「存活天数」）。`metric` 保留为显式协议字段，但当前版本只支持
 * 唯一会被 ResultEntry 保留的稳定键 `tiebreak_value`；其他键在定义入库前
 * 就失败，避免「声明可用但结果解析时静默丢失」。缺省时排名行为与历史完全
 * 一致（score desc 单键 + 稳定身份 tiebreak）。
 */
export const EvalTiebreakSchema = z.object({
    metric: z.literal("tiebreak_value"),
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
const UpstreamContributorSchema = z
    .string()
    .regex(/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/u, "upstream.contributors 必须是合法 GitHub handle（不带 @）");
/**
 * 上游代码快照的精确标识。references 提供的是可点链接，upstream 记录的是
 * 「这份评测内容来自哪个 repo 的哪个 commit」这一事实，用于详情页署名与追溯。
 * CI 不校验 repo 是否真实存在，防线是 admin 的 PR review。
 */
export const UpstreamSourceSchema = z
    .object({
    repo: z
        .string()
        .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u, "upstream.repo 必须是 owner/name 格式")
        .max(200, "upstream.repo 最长 200 字符"),
    commit: z
        .string()
        .regex(/^[0-9a-f]{7,40}$/u, "upstream.commit 必须是 7-40 位小写十六进制 Git commit"),
    paper: EvalReferenceUrlSchema.optional(),
    contributors: z
        .array(UpstreamContributorSchema)
        .max(10, "upstream.contributors 最多 10 个")
        .optional(),
})
    .strict();
const DetailProfileStableIdSchema = z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "detail_profile id 必须是稳定的小写 slug");
function requiredDetailProfileText(maxLength, field) {
    return z
        .string()
        .min(1, `${field} 不能为空`)
        .max(maxLength, `${field} 最长 ${maxLength} 字符`)
        .refine((value) => value.trim().length > 0, {
        message: `${field} 不能只包含空白字符`,
    });
}
function requiredDetailProfilePlainText(maxLength, field) {
    return requiredDetailProfileText(maxLength, field).refine((value) => !CONTROL_CHARACTERS.test(value), { message: `${field} 不能包含控制字符` });
}
const DetailProfileSummarySchema = z
    .object({
    plain_language: requiredDetailProfileText(600, "detail_profile.summary.plain_language"),
    why_it_matters: requiredDetailProfileText(600, "detail_profile.summary.why_it_matters"),
})
    .strict();
const DetailProfileMethodStepSchema = z
    .object({
    title: requiredDetailProfileText(80, "detail_profile.method_steps[].title"),
    description: requiredDetailProfileText(500, "detail_profile.method_steps[].description"),
})
    .strict();
const DetailProfileKeyFactSchema = z
    .object({
    value: requiredDetailProfileText(80, "detail_profile.key_facts[].value"),
    label: requiredDetailProfileText(120, "detail_profile.key_facts[].label"),
    description: z.string().max(300).optional(),
    source_url: EvalReferenceUrlSchema.optional(),
})
    .strict();
const DetailProfileCaveatSchema = z
    .object({
    title: requiredDetailProfileText(100, "detail_profile.caveats[].title"),
    description: requiredDetailProfileText(500, "detail_profile.caveats[].description"),
})
    .strict();
const DetailProfileFigureSchema = z
    .object({
    id: DetailProfileStableIdSchema,
    /**
     * Figures default to the explanatory "关于这套评测" module. Source figures
     * that are themselves an official result artifact can opt into the fixed
     * "官方分项结果" module without requiring eval-specific React code.
     */
    placement: z.enum(["overview", "insights"]).optional(),
    label: requiredDetailProfileText(40, "detail_profile.figures[].label"),
    title: requiredDetailProfileText(120, "detail_profile.figures[].title"),
    src: EvalReferenceUrlSchema,
    alt: requiredDetailProfileText(240, "detail_profile.figures[].alt"),
    caption: requiredDetailProfileText(500, "detail_profile.figures[].caption"),
    source_url: EvalReferenceUrlSchema,
})
    .strict();
const DetailProfileOverviewTableColumnSchema = z
    .object({
    id: DetailProfileStableIdSchema,
    label: requiredDetailProfilePlainText(80, "detail_profile.overview_tables[].columns[].label"),
})
    .strict();
const DetailProfileOverviewTableCellSchema = z
    .object({
    column_id: DetailProfileStableIdSchema,
    value: z.union([
        requiredDetailProfilePlainText(500, "detail_profile.overview_tables[].rows[].cells[].value"),
        z.number().finite(),
    ]),
})
    .strict();
const DetailProfileOverviewTableRowSchema = z
    .object({
    id: DetailProfileStableIdSchema,
    cells: z.array(DetailProfileOverviewTableCellSchema).min(2).max(8),
})
    .strict();
const DetailProfileOverviewTableSchema = z
    .object({
    id: DetailProfileStableIdSchema,
    label: requiredDetailProfilePlainText(40, "detail_profile.overview_tables[].label"),
    title: requiredDetailProfilePlainText(120, "detail_profile.overview_tables[].title"),
    note: requiredDetailProfilePlainText(500, "detail_profile.overview_tables[].note"),
    columns: z.array(DetailProfileOverviewTableColumnSchema).min(2).max(8),
    rows: z.array(DetailProfileOverviewTableRowSchema).min(1).max(30),
    caption: requiredDetailProfilePlainText(500, "detail_profile.overview_tables[].caption").optional(),
    source_url: EvalReferenceUrlSchema,
})
    .strict()
    .superRefine((table, ctx) => {
    const columnIds = new Set();
    for (const [index, column] of table.columns.entries()) {
        if (columnIds.has(column.id)) {
            ctx.addIssue({
                code: "custom",
                path: ["columns", index, "id"],
                message: "detail_profile overview table column ids must be unique",
            });
        }
        else {
            columnIds.add(column.id);
        }
    }
    const rowIds = new Set();
    for (const [rowIndex, row] of table.rows.entries()) {
        if (rowIds.has(row.id)) {
            ctx.addIssue({
                code: "custom",
                path: ["rows", rowIndex, "id"],
                message: "detail_profile overview table row ids must be unique",
            });
        }
        else {
            rowIds.add(row.id);
        }
        const referencedColumnIds = new Set();
        for (const [cellIndex, cell] of row.cells.entries()) {
            if (!columnIds.has(cell.column_id)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["rows", rowIndex, "cells", cellIndex, "column_id"],
                    message: "detail_profile overview table cell must reference a declared column",
                });
            }
            if (referencedColumnIds.has(cell.column_id)) {
                ctx.addIssue({
                    code: "custom",
                    path: ["rows", rowIndex, "cells", cellIndex, "column_id"],
                    message: "detail_profile overview table row cannot repeat a column",
                });
            }
            referencedColumnIds.add(cell.column_id);
        }
        const rowIsComplete = referencedColumnIds.size === columnIds.size &&
            [...columnIds].every((columnId) => referencedColumnIds.has(columnId));
        if (!rowIsComplete) {
            ctx.addIssue({
                code: "custom",
                path: ["rows", rowIndex, "cells"],
                message: "detail_profile overview table row must contain exactly one cell for every column",
            });
        }
    }
});
const DetailProfileResourceSchema = z
    .object({
    title: requiredDetailProfileText(120, "detail_profile.resources[].title"),
    summary: requiredDetailProfileText(300, "detail_profile.resources[].summary"),
    url: EvalReferenceUrlSchema,
})
    .strict();
/**
 * 评测详情页的统一编辑型信息结构。该字段只负责解释评测本身；各模型的
 * 官方分项成绩与趋势仍由 result.supplementary_views 承载。
 */
export const EvalDetailProfileSchema = z
    .object({
    source_kind: z.enum(["evalhub_native", "upstream_publication"]),
    overview_note: requiredDetailProfilePlainText(600, "detail_profile.overview_note").optional(),
    summary: DetailProfileSummarySchema,
    method_steps: z.array(DetailProfileMethodStepSchema).min(2).max(6),
    score_interpretation: requiredDetailProfileText(600, "detail_profile.score_interpretation"),
    key_facts: z.array(DetailProfileKeyFactSchema).max(6).optional(),
    caveats: z.array(DetailProfileCaveatSchema).min(1).max(6),
    overview_tables: z.array(DetailProfileOverviewTableSchema).max(3).optional(),
    figures: z.array(DetailProfileFigureSchema).max(3).optional(),
    resources_note: requiredDetailProfilePlainText(600, "detail_profile.resources_note").optional(),
    resources: z.array(DetailProfileResourceSchema).min(1).max(6),
})
    .strict()
    .superRefine((profile, ctx) => {
    const figureIds = new Set();
    for (const [index, figure] of (profile.figures ?? []).entries()) {
        if (figureIds.has(figure.id)) {
            ctx.addIssue({
                code: "custom",
                path: ["figures", index, "id"],
                message: "detail_profile figure ids must be unique",
            });
        }
        else {
            figureIds.add(figure.id);
        }
    }
    const tableIds = new Set();
    for (const [index, table] of (profile.overview_tables ?? []).entries()) {
        if (tableIds.has(table.id)) {
            ctx.addIssue({
                code: "custom",
                path: ["overview_tables", index, "id"],
                message: "detail_profile overview table ids must be unique",
            });
        }
        else {
            tableIds.add(table.id);
        }
    }
});
const evalDefShape = {
    id: EvalIdSchema,
    hackathon_id: EvalIdSchema.optional(),
    // 单调递增的计分协议版本。展示文案、README、引用链接或官方基线更新不应升版；
    // 任务、运行方式、主分数、同分规则等可比性语义变化时必须递增。
    protocol_revision: z.number().int().positive().default(1),
    name: z.string().min(1),
    category: z.enum(["fun", "useful"]),
    description: z.string().min(1),
    hook_title: z.string().optional(),
    references: EvalReferencesSchema.optional(),
    upstream: UpstreamSourceSchema.optional(),
    // 可选以兼容历史评测集；新提交的完整性由 evals 仓库 authoring gate 约束。
    detail_profile: EvalDetailProfileSchema.optional(),
    dimensions: z
        .array(z.enum(["幽默", "语言", "推理", "代码", "博弈", "经营"]))
        .min(1)
        .max(2),
    interface: z.enum(["chat", "dialogue", "agent"]),
    runner: z.enum(["builtin", "custom"]),
    // custom runner 分为可由 CLI 执行的 runner，以及先在外部基础设施运行、再由 CLI 打包的流程。
    // 旧定义省略时按 executable 处理，保持兼容。
    custom_mode: CustomRunnerModeSchema.optional(),
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
        label: z
            .string()
            .max(MAX_TASK_LABEL_LENGTH, `tasks[].label 最长 ${MAX_TASK_LABEL_LENGTH} 字符`)
            .refine((value) => value.trim().length > 0, {
            message: "tasks[].label 不能为空",
        })
            .optional(),
        // 唯一的题面字段：既是真正执行的指令，也是详情页展示的原文。
        //
        // - `runner: builtin`：这就是发给参赛模型的那句话。
        // - `source_kind: upstream_publication`：逐字照抄上游公开的题面原文，
        //   平台不得改写、摘要、截断或替换成链接；未替换的模板占位符也原样保留，
        //   便于与上游 pinned commit 逐字比对。EvalHub 自己补充的运行约定写进
        //   `run_spec`，绝不混进这里。
        //
        // 保留原始字符（包括首尾空白），只拒绝纯空白值；不设长度上限、不截断，
        // 折叠由前端负责。
        prompt: z.string().min(1).refine((value) => value.trim().length > 0, {
            message: "tasks[].prompt 不能为空",
        }),
        // EvalHub 为可复现而补充的运行规程：固定配置、证据采集口径、占位符实际取值等。
        // 它**不在详情页渲染**，只随 eval 目录交到实际跑评测的人手里（`evalhub fetch`
        // clone 作者仓库的 pinned commit），因此参赛者按它执行，读者不会把它误当题面。
        // external_workflow 的参赛者靠它复现，所以改它必须按协议变更递增
        // protocol_revision。
        run_spec: z
            .string()
            .refine((value) => value.trim().length > 0, {
            message: "tasks[].run_spec 不能为空",
        })
            .optional(),
        translation: z
            .string()
            .max(MAX_TASK_TRANSLATION_LENGTH, `tasks[].translation 最长 ${MAX_TASK_TRANSLATION_LENGTH} 字符`)
            .refine((value) => value.trim().length > 0, {
            message: "tasks[].translation 不能为空",
        })
            .optional(),
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
    if (v.leaderboard === "rating" && v.baseline_policy === "required") {
        ctx.addIssue({
            code: "custom",
            path: ["baseline_policy"],
            message: "baseline_policy=required 暂不支持 leaderboard=rating；rating 榜必须由 team_games 对局生成",
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
    if (v.runner === "builtin" && v.custom_mode !== undefined) {
        ctx.addIssue({
            code: "custom",
            path: ["custom_mode"],
            message: "runner=builtin 不能提供 custom_mode",
        });
    }
    const inputPlaceholders = v.command_template?.argv.filter((arg) => arg === "{input}").length ?? 0;
    if (v.runner === "custom" &&
        v.custom_mode === "external_workflow" &&
        inputPlaceholders !== 1) {
        ctx.addIssue({
            code: "custom",
            path: ["command_template", "argv"],
            message: "custom_mode=external_workflow 的 command_template.argv 必须包含一个独立 {input} token",
        });
    }
    if (v.runner === "custom" &&
        v.custom_mode !== "external_workflow" &&
        inputPlaceholders > 0) {
        ctx.addIssue({
            code: "custom",
            path: ["custom_mode"],
            message: "command_template 使用 {input} 时必须声明 custom_mode=external_workflow",
        });
    }
    if (v.runner === "builtin" && v.command_template) {
        ctx.addIssue({
            code: "custom",
            path: ["command_template"],
            message: "runner=builtin 不能提供 command_template",
        });
    }
    if (v.runner === "builtin" &&
        v.scoring === "custom" &&
        resolveScorePolicy(v) === "required") {
        ctx.addIssue({
            code: "custom",
            path: ["score_policy"],
            message: "runner=builtin 不支持 scoring=custom + score_policy=required；请使用 runner=custom 提供计分器，或改为 score_policy=author_fill",
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
export function resolveCustomRunnerMode(value) {
    return value.runner === "custom" ? (value.custom_mode ?? "executable") : null;
}
