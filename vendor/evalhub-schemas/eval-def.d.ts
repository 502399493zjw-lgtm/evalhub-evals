import { z } from "zod";
export declare const EvalIdSchema: z.ZodString;
export declare const EvalCoverPathSchema: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
export declare const CommandOutputSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
export declare const CommandOutputOverrideSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
export declare const CommandInputOverrideSchema: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
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
export declare const CustomRunnerModeSchema: z.ZodEnum<["executable", "external_workflow"]>;
export type CustomRunnerMode = z.infer<typeof CustomRunnerModeSchema>;
/**
 * 评测集级同分 tiebreak 声明（可选）：同分（score 相等）时按 result
 * `raw_metric.tiebreak_value` 的有限数值排序，方向由 `order` 决定，`label`
 * 供展示（如「存活天数」）。`metric` 保留为显式协议字段，但当前版本只支持
 * 唯一会被 ResultEntry 保留的稳定键 `tiebreak_value`；其他键在定义入库前
 * 就失败，避免「声明可用但结果解析时静默丢失」。缺省时排名行为与历史完全
 * 一致（score desc 单键 + 稳定身份 tiebreak）。
 */
export declare const EvalTiebreakSchema: z.ZodObject<{
    metric: z.ZodLiteral<"tiebreak_value">;
    order: z.ZodEnum<["desc", "asc"]>;
    label: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    metric: "tiebreak_value";
    order: "desc" | "asc";
    label: string;
}, {
    metric: "tiebreak_value";
    order: "desc" | "asc";
    label: string;
}>;
export type EvalTiebreak = z.infer<typeof EvalTiebreakSchema>;
/**
 * 评测集的第一方外部资料。EvalHub 自身的源码目录链接由平台根据 repoPath 生成，
 * 不在这里重复声明；repository 指被接入项目的上游作者仓库。
 */
export declare const EvalReferencesSchema: z.ZodEffects<z.ZodObject<{
    homepage: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    paper: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    repository: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    homepage?: string | undefined;
    paper?: string | undefined;
    repository?: string | undefined;
}, {
    homepage?: string | undefined;
    paper?: string | undefined;
    repository?: string | undefined;
}>, {
    homepage?: string | undefined;
    paper?: string | undefined;
    repository?: string | undefined;
}, {
    homepage?: string | undefined;
    paper?: string | undefined;
    repository?: string | undefined;
}>;
export type EvalReferences = z.infer<typeof EvalReferencesSchema>;
/**
 * 上游代码快照的精确标识。references 提供的是可点链接，upstream 记录的是
 * 「这份评测内容来自哪个 repo 的哪个 commit」这一事实，用于详情页署名与追溯。
 * CI 不校验 repo 是否真实存在，防线是 admin 的 PR review。
 */
export declare const UpstreamSourceSchema: z.ZodObject<{
    repo: z.ZodString;
    commit: z.ZodString;
    paper: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    contributors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strict", z.ZodTypeAny, {
    repo: string;
    commit: string;
    paper?: string | undefined;
    contributors?: string[] | undefined;
}, {
    repo: string;
    commit: string;
    paper?: string | undefined;
    contributors?: string[] | undefined;
}>;
export type UpstreamSource = z.infer<typeof UpstreamSourceSchema>;
/**
 * 评测详情页的统一编辑型信息结构。该字段只负责解释评测本身；各模型的
 * 官方分项成绩与趋势仍由 result.supplementary_views 承载。
 */
export declare const EvalDetailProfileSchema: z.ZodEffects<z.ZodObject<{
    source_kind: z.ZodEnum<["evalhub_native", "upstream_publication"]>;
    overview_note: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    summary: z.ZodObject<{
        plain_language: z.ZodEffects<z.ZodString, string, string>;
        why_it_matters: z.ZodEffects<z.ZodString, string, string>;
    }, "strict", z.ZodTypeAny, {
        plain_language: string;
        why_it_matters: string;
    }, {
        plain_language: string;
        why_it_matters: string;
    }>;
    method_steps: z.ZodArray<z.ZodObject<{
        title: z.ZodEffects<z.ZodString, string, string>;
        description: z.ZodEffects<z.ZodString, string, string>;
    }, "strict", z.ZodTypeAny, {
        title: string;
        description: string;
    }, {
        title: string;
        description: string;
    }>, "many">;
    score_interpretation: z.ZodEffects<z.ZodString, string, string>;
    key_facts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodEffects<z.ZodString, string, string>;
        label: z.ZodEffects<z.ZodString, string, string>;
        description: z.ZodOptional<z.ZodString>;
        source_url: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strict", z.ZodTypeAny, {
        value: string;
        label: string;
        description?: string | undefined;
        source_url?: string | undefined;
    }, {
        value: string;
        label: string;
        description?: string | undefined;
        source_url?: string | undefined;
    }>, "many">>;
    caveats: z.ZodArray<z.ZodObject<{
        title: z.ZodEffects<z.ZodString, string, string>;
        description: z.ZodEffects<z.ZodString, string, string>;
    }, "strict", z.ZodTypeAny, {
        title: string;
        description: string;
    }, {
        title: string;
        description: string;
    }>, "many">;
    overview_tables: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        title: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        note: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        columns: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            id: string;
        }, {
            label: string;
            id: string;
        }>, "many">;
        rows: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            cells: z.ZodArray<z.ZodObject<{
                column_id: z.ZodString;
                value: z.ZodUnion<[z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, z.ZodNumber]>;
            }, "strict", z.ZodTypeAny, {
                value: string | number;
                column_id: string;
            }, {
                value: string | number;
                column_id: string;
            }>, "many">;
        }, "strict", z.ZodTypeAny, {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }, {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }>, "many">;
        caption: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
        source_url: z.ZodEffects<z.ZodString, string, string>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        title: string;
        source_url: string;
        id: string;
        note: string;
        columns: {
            label: string;
            id: string;
        }[];
        rows: {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }[];
        caption?: string | undefined;
    }, {
        label: string;
        title: string;
        source_url: string;
        id: string;
        note: string;
        columns: {
            label: string;
            id: string;
        }[];
        rows: {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }[];
        caption?: string | undefined;
    }>, {
        label: string;
        title: string;
        source_url: string;
        id: string;
        note: string;
        columns: {
            label: string;
            id: string;
        }[];
        rows: {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }[];
        caption?: string | undefined;
    }, {
        label: string;
        title: string;
        source_url: string;
        id: string;
        note: string;
        columns: {
            label: string;
            id: string;
        }[];
        rows: {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }[];
        caption?: string | undefined;
    }>, "many">>;
    figures: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /**
         * Figures default to the explanatory "关于这套评测" module. Source figures
         * that are themselves an official result artifact can opt into the fixed
         * "官方分项结果" module without requiring eval-specific React code.
         */
        placement: z.ZodOptional<z.ZodEnum<["overview", "insights"]>>;
        label: z.ZodEffects<z.ZodString, string, string>;
        title: z.ZodEffects<z.ZodString, string, string>;
        src: z.ZodEffects<z.ZodString, string, string>;
        alt: z.ZodEffects<z.ZodString, string, string>;
        caption: z.ZodEffects<z.ZodString, string, string>;
        source_url: z.ZodEffects<z.ZodString, string, string>;
    }, "strict", z.ZodTypeAny, {
        label: string;
        title: string;
        source_url: string;
        id: string;
        src: string;
        alt: string;
        caption: string;
        placement?: "overview" | "insights" | undefined;
    }, {
        label: string;
        title: string;
        source_url: string;
        id: string;
        src: string;
        alt: string;
        caption: string;
        placement?: "overview" | "insights" | undefined;
    }>, "many">>;
    resources_note: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    resources: z.ZodArray<z.ZodObject<{
        title: z.ZodEffects<z.ZodString, string, string>;
        summary: z.ZodEffects<z.ZodString, string, string>;
        url: z.ZodEffects<z.ZodString, string, string>;
    }, "strict", z.ZodTypeAny, {
        title: string;
        summary: string;
        url: string;
    }, {
        title: string;
        summary: string;
        url: string;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    summary: {
        plain_language: string;
        why_it_matters: string;
    };
    source_kind: "evalhub_native" | "upstream_publication";
    method_steps: {
        title: string;
        description: string;
    }[];
    score_interpretation: string;
    caveats: {
        title: string;
        description: string;
    }[];
    resources: {
        title: string;
        summary: string;
        url: string;
    }[];
    overview_note?: string | undefined;
    key_facts?: {
        value: string;
        label: string;
        description?: string | undefined;
        source_url?: string | undefined;
    }[] | undefined;
    overview_tables?: {
        label: string;
        title: string;
        source_url: string;
        id: string;
        note: string;
        columns: {
            label: string;
            id: string;
        }[];
        rows: {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }[];
        caption?: string | undefined;
    }[] | undefined;
    figures?: {
        label: string;
        title: string;
        source_url: string;
        id: string;
        src: string;
        alt: string;
        caption: string;
        placement?: "overview" | "insights" | undefined;
    }[] | undefined;
    resources_note?: string | undefined;
}, {
    summary: {
        plain_language: string;
        why_it_matters: string;
    };
    source_kind: "evalhub_native" | "upstream_publication";
    method_steps: {
        title: string;
        description: string;
    }[];
    score_interpretation: string;
    caveats: {
        title: string;
        description: string;
    }[];
    resources: {
        title: string;
        summary: string;
        url: string;
    }[];
    overview_note?: string | undefined;
    key_facts?: {
        value: string;
        label: string;
        description?: string | undefined;
        source_url?: string | undefined;
    }[] | undefined;
    overview_tables?: {
        label: string;
        title: string;
        source_url: string;
        id: string;
        note: string;
        columns: {
            label: string;
            id: string;
        }[];
        rows: {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }[];
        caption?: string | undefined;
    }[] | undefined;
    figures?: {
        label: string;
        title: string;
        source_url: string;
        id: string;
        src: string;
        alt: string;
        caption: string;
        placement?: "overview" | "insights" | undefined;
    }[] | undefined;
    resources_note?: string | undefined;
}>, {
    summary: {
        plain_language: string;
        why_it_matters: string;
    };
    source_kind: "evalhub_native" | "upstream_publication";
    method_steps: {
        title: string;
        description: string;
    }[];
    score_interpretation: string;
    caveats: {
        title: string;
        description: string;
    }[];
    resources: {
        title: string;
        summary: string;
        url: string;
    }[];
    overview_note?: string | undefined;
    key_facts?: {
        value: string;
        label: string;
        description?: string | undefined;
        source_url?: string | undefined;
    }[] | undefined;
    overview_tables?: {
        label: string;
        title: string;
        source_url: string;
        id: string;
        note: string;
        columns: {
            label: string;
            id: string;
        }[];
        rows: {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }[];
        caption?: string | undefined;
    }[] | undefined;
    figures?: {
        label: string;
        title: string;
        source_url: string;
        id: string;
        src: string;
        alt: string;
        caption: string;
        placement?: "overview" | "insights" | undefined;
    }[] | undefined;
    resources_note?: string | undefined;
}, {
    summary: {
        plain_language: string;
        why_it_matters: string;
    };
    source_kind: "evalhub_native" | "upstream_publication";
    method_steps: {
        title: string;
        description: string;
    }[];
    score_interpretation: string;
    caveats: {
        title: string;
        description: string;
    }[];
    resources: {
        title: string;
        summary: string;
        url: string;
    }[];
    overview_note?: string | undefined;
    key_facts?: {
        value: string;
        label: string;
        description?: string | undefined;
        source_url?: string | undefined;
    }[] | undefined;
    overview_tables?: {
        label: string;
        title: string;
        source_url: string;
        id: string;
        note: string;
        columns: {
            label: string;
            id: string;
        }[];
        rows: {
            id: string;
            cells: {
                value: string | number;
                column_id: string;
            }[];
        }[];
        caption?: string | undefined;
    }[] | undefined;
    figures?: {
        label: string;
        title: string;
        source_url: string;
        id: string;
        src: string;
        alt: string;
        caption: string;
        placement?: "overview" | "insights" | undefined;
    }[] | undefined;
    resources_note?: string | undefined;
}>;
export type EvalDetailProfile = z.infer<typeof EvalDetailProfileSchema>;
/** 每道题最多挂的演示媒体条数：示例区是说明位，不是相册。 */
export declare const MAX_TASK_MEDIA_ITEMS = 4;
/**
 * 题目示例的演示媒体（图片/视频）：视频、3D 白模类评测在详情页示例区展示
 * 上游发布的演示素材（用户拍板 2026-08-10）。
 *
 * 校验口径整体镜像 detail_profile.figures：src/source_url 走同一条
 * EvalReferenceUrlSchema（无凭证 HTTPS、同一长度上限），alt 是 a11y 硬要求
 * （同 figures[].alt 的 240 上限），caption 上限同 figures[].caption。
 * 与 figures 的差异：caption 与 source_url 可选——示例媒体是题面的随行说明，
 * 不是独立的成绩证据模块；但声明了 source_url 时详情页会如实标注来源。
 */
export declare const EvalTaskMediaSchema: z.ZodObject<{
    type: z.ZodEnum<["image", "video"]>;
    src: z.ZodEffects<z.ZodString, string, string>;
    alt: z.ZodEffects<z.ZodString, string, string>;
    caption: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    source_url: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strict", z.ZodTypeAny, {
    type: "image" | "video";
    src: string;
    alt: string;
    source_url?: string | undefined;
    caption?: string | undefined;
}, {
    type: "image" | "video";
    src: string;
    alt: string;
    source_url?: string | undefined;
    caption?: string | undefined;
}>;
export type EvalTaskMedia = z.infer<typeof EvalTaskMediaSchema>;
type EvalDefRefinementValue = {
    scoring: "exact" | "judge" | "custom";
    scored_by: "local" | "author";
    score_policy?: "required" | "author_fill" | undefined;
    runner: "builtin" | "custom";
    custom_mode?: CustomRunnerMode | undefined;
    judge_model?: string | undefined;
    scoring_note?: string | undefined;
    command_template?: CommandTemplate | null | undefined;
    interface: "chat" | "dialogue" | "agent";
    leaderboard: "latest_session" | "rating";
    baseline_policy: "optional" | "required";
};
export declare const EvalDefSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
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
    protocol_revision: z.ZodDefault<z.ZodNumber>;
    protocol_note: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    category: z.ZodEnum<["fun", "useful"]>;
    description: z.ZodString;
    hook_title: z.ZodOptional<z.ZodString>;
    cover: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    references: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        homepage: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        paper: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        repository: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strict", z.ZodTypeAny, {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    }, {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    }>, {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    }, {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    }>>;
    upstream: z.ZodOptional<z.ZodObject<{
        repo: z.ZodString;
        commit: z.ZodString;
        paper: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        contributors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    }, {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    }>>;
    detail_profile: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        source_kind: z.ZodEnum<["evalhub_native", "upstream_publication"]>;
        overview_note: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
        summary: z.ZodObject<{
            plain_language: z.ZodEffects<z.ZodString, string, string>;
            why_it_matters: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            plain_language: string;
            why_it_matters: string;
        }, {
            plain_language: string;
            why_it_matters: string;
        }>;
        method_steps: z.ZodArray<z.ZodObject<{
            title: z.ZodEffects<z.ZodString, string, string>;
            description: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            title: string;
            description: string;
        }, {
            title: string;
            description: string;
        }>, "many">;
        score_interpretation: z.ZodEffects<z.ZodString, string, string>;
        key_facts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            value: z.ZodEffects<z.ZodString, string, string>;
            label: z.ZodEffects<z.ZodString, string, string>;
            description: z.ZodOptional<z.ZodString>;
            source_url: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        }, "strict", z.ZodTypeAny, {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }, {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }>, "many">>;
        caveats: z.ZodArray<z.ZodObject<{
            title: z.ZodEffects<z.ZodString, string, string>;
            description: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            title: string;
            description: string;
        }, {
            title: string;
            description: string;
        }>, "many">;
        overview_tables: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            title: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            note: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            columns: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                id: string;
            }, {
                label: string;
                id: string;
            }>, "many">;
            rows: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                cells: z.ZodArray<z.ZodObject<{
                    column_id: z.ZodString;
                    value: z.ZodUnion<[z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, z.ZodNumber]>;
                }, "strict", z.ZodTypeAny, {
                    value: string | number;
                    column_id: string;
                }, {
                    value: string | number;
                    column_id: string;
                }>, "many">;
            }, "strict", z.ZodTypeAny, {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }, {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }>, "many">;
            caption: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
            source_url: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }>, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }>, "many">>;
        figures: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            /**
             * Figures default to the explanatory "关于这套评测" module. Source figures
             * that are themselves an official result artifact can opt into the fixed
             * "官方分项结果" module without requiring eval-specific React code.
             */
            placement: z.ZodOptional<z.ZodEnum<["overview", "insights"]>>;
            label: z.ZodEffects<z.ZodString, string, string>;
            title: z.ZodEffects<z.ZodString, string, string>;
            src: z.ZodEffects<z.ZodString, string, string>;
            alt: z.ZodEffects<z.ZodString, string, string>;
            caption: z.ZodEffects<z.ZodString, string, string>;
            source_url: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }>, "many">>;
        resources_note: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
        resources: z.ZodArray<z.ZodObject<{
            title: z.ZodEffects<z.ZodString, string, string>;
            summary: z.ZodEffects<z.ZodString, string, string>;
            url: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            title: string;
            summary: string;
            url: string;
        }, {
            title: string;
            summary: string;
            url: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    }, {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    }>, {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    }, {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    }>>;
    dimensions: z.ZodArray<z.ZodEnum<["幽默", "语言", "推理", "代码", "博弈", "经营"]>, "many">;
    interface: z.ZodEnum<["chat", "dialogue", "agent"]>;
    runner: z.ZodEnum<["builtin", "custom"]>;
    custom_mode: z.ZodOptional<z.ZodEnum<["executable", "external_workflow"]>>;
    scoring: z.ZodEnum<["exact", "judge", "custom"]>;
    scored_by: z.ZodEnum<["local", "author"]>;
    score_policy: z.ZodOptional<z.ZodEnum<["required", "author_fill"]>>;
    baseline_policy: z.ZodDefault<z.ZodEnum<["optional", "required"]>>;
    score_unit: z.ZodDefault<z.ZodString>;
    leaderboard: z.ZodDefault<z.ZodEnum<["latest_session", "rating"]>>;
    tiebreak: z.ZodOptional<z.ZodObject<{
        metric: z.ZodLiteral<"tiebreak_value">;
        order: z.ZodEnum<["desc", "asc"]>;
        label: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    }, {
        metric: "tiebreak_value";
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
        label: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        prompt: z.ZodEffects<z.ZodString, string, string>;
        run_spec: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        translation: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        expected: z.ZodOptional<z.ZodString>;
        media: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["image", "video"]>;
            src: z.ZodEffects<z.ZodString, string, string>;
            alt: z.ZodEffects<z.ZodString, string, string>;
            caption: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
            source_url: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        }, "strict", z.ZodTypeAny, {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }, {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }, {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    description: string;
    id: string;
    leaderboard: "latest_session" | "rating";
    baseline_policy: "required" | "optional";
    scored_by: "local" | "author";
    protocol_revision: number;
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: {
        argv: string[];
        output: string;
    } | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    description: string;
    id: string;
    scored_by: "local" | "author";
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    baseline_policy?: "required" | "optional" | undefined;
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_revision?: number | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    trials?: number | undefined;
    est_tokens?: number | undefined;
}>, {
    description: string;
    id: string;
    leaderboard: "latest_session" | "rating";
    baseline_policy: "required" | "optional";
    scored_by: "local" | "author";
    protocol_revision: number;
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: {
        argv: string[];
        output: string;
    } | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    description: string;
    id: string;
    scored_by: "local" | "author";
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    baseline_policy?: "required" | "optional" | undefined;
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_revision?: number | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    trials?: number | undefined;
    est_tokens?: number | undefined;
}>, {
    score_policy: "required" | "author_fill";
    description: string;
    id: string;
    leaderboard: "latest_session" | "rating";
    baseline_policy: "required" | "optional";
    scored_by: "local" | "author";
    protocol_revision: number;
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    command_template?: {
        argv: string[];
        output: string;
    } | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    description: string;
    id: string;
    scored_by: "local" | "author";
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    baseline_policy?: "required" | "optional" | undefined;
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_revision?: number | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
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
export declare const StoredEvalDefSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
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
    protocol_revision: z.ZodDefault<z.ZodNumber>;
    protocol_note: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    category: z.ZodEnum<["fun", "useful"]>;
    description: z.ZodString;
    hook_title: z.ZodOptional<z.ZodString>;
    cover: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    references: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        homepage: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        paper: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        repository: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    }, "strict", z.ZodTypeAny, {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    }, {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    }>, {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    }, {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    }>>;
    upstream: z.ZodOptional<z.ZodObject<{
        repo: z.ZodString;
        commit: z.ZodString;
        paper: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        contributors: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    }, {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    }>>;
    detail_profile: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        source_kind: z.ZodEnum<["evalhub_native", "upstream_publication"]>;
        overview_note: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
        summary: z.ZodObject<{
            plain_language: z.ZodEffects<z.ZodString, string, string>;
            why_it_matters: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            plain_language: string;
            why_it_matters: string;
        }, {
            plain_language: string;
            why_it_matters: string;
        }>;
        method_steps: z.ZodArray<z.ZodObject<{
            title: z.ZodEffects<z.ZodString, string, string>;
            description: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            title: string;
            description: string;
        }, {
            title: string;
            description: string;
        }>, "many">;
        score_interpretation: z.ZodEffects<z.ZodString, string, string>;
        key_facts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            value: z.ZodEffects<z.ZodString, string, string>;
            label: z.ZodEffects<z.ZodString, string, string>;
            description: z.ZodOptional<z.ZodString>;
            source_url: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        }, "strict", z.ZodTypeAny, {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }, {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }>, "many">>;
        caveats: z.ZodArray<z.ZodObject<{
            title: z.ZodEffects<z.ZodString, string, string>;
            description: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            title: string;
            description: string;
        }, {
            title: string;
            description: string;
        }>, "many">;
        overview_tables: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
            id: z.ZodString;
            label: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            title: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            note: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            columns: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                label: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
            }, "strict", z.ZodTypeAny, {
                label: string;
                id: string;
            }, {
                label: string;
                id: string;
            }>, "many">;
            rows: z.ZodArray<z.ZodObject<{
                id: z.ZodString;
                cells: z.ZodArray<z.ZodObject<{
                    column_id: z.ZodString;
                    value: z.ZodUnion<[z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, z.ZodNumber]>;
                }, "strict", z.ZodTypeAny, {
                    value: string | number;
                    column_id: string;
                }, {
                    value: string | number;
                    column_id: string;
                }>, "many">;
            }, "strict", z.ZodTypeAny, {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }, {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }>, "many">;
            caption: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
            source_url: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }>, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }>, "many">>;
        figures: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            /**
             * Figures default to the explanatory "关于这套评测" module. Source figures
             * that are themselves an official result artifact can opt into the fixed
             * "官方分项结果" module without requiring eval-specific React code.
             */
            placement: z.ZodOptional<z.ZodEnum<["overview", "insights"]>>;
            label: z.ZodEffects<z.ZodString, string, string>;
            title: z.ZodEffects<z.ZodString, string, string>;
            src: z.ZodEffects<z.ZodString, string, string>;
            alt: z.ZodEffects<z.ZodString, string, string>;
            caption: z.ZodEffects<z.ZodString, string, string>;
            source_url: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }, {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }>, "many">>;
        resources_note: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
        resources: z.ZodArray<z.ZodObject<{
            title: z.ZodEffects<z.ZodString, string, string>;
            summary: z.ZodEffects<z.ZodString, string, string>;
            url: z.ZodEffects<z.ZodString, string, string>;
        }, "strict", z.ZodTypeAny, {
            title: string;
            summary: string;
            url: string;
        }, {
            title: string;
            summary: string;
            url: string;
        }>, "many">;
    }, "strict", z.ZodTypeAny, {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    }, {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    }>, {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    }, {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    }>>;
    dimensions: z.ZodArray<z.ZodEnum<["幽默", "语言", "推理", "代码", "博弈", "经营"]>, "many">;
    interface: z.ZodEnum<["chat", "dialogue", "agent"]>;
    runner: z.ZodEnum<["builtin", "custom"]>;
    custom_mode: z.ZodOptional<z.ZodEnum<["executable", "external_workflow"]>>;
    scoring: z.ZodEnum<["exact", "judge", "custom"]>;
    scored_by: z.ZodEnum<["local", "author"]>;
    score_policy: z.ZodOptional<z.ZodEnum<["required", "author_fill"]>>;
    baseline_policy: z.ZodDefault<z.ZodEnum<["optional", "required"]>>;
    score_unit: z.ZodDefault<z.ZodString>;
    leaderboard: z.ZodDefault<z.ZodEnum<["latest_session", "rating"]>>;
    tiebreak: z.ZodOptional<z.ZodObject<{
        metric: z.ZodLiteral<"tiebreak_value">;
        order: z.ZodEnum<["desc", "asc"]>;
        label: z.ZodEffects<z.ZodString, string, string>;
    }, "strip", z.ZodTypeAny, {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    }, {
        metric: "tiebreak_value";
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
        label: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        prompt: z.ZodEffects<z.ZodString, string, string>;
        run_spec: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        translation: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        expected: z.ZodOptional<z.ZodString>;
        media: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["image", "video"]>;
            src: z.ZodEffects<z.ZodString, string, string>;
            alt: z.ZodEffects<z.ZodString, string, string>;
            caption: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
            source_url: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        }, "strict", z.ZodTypeAny, {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }, {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }, {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    description: string;
    id: string;
    leaderboard: "latest_session" | "rating";
    baseline_policy: "required" | "optional";
    scored_by: "local" | "author";
    protocol_revision: number;
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: {
        argv: string[];
        output: string;
    } | null | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    description: string;
    id: string;
    scored_by: "local" | "author";
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    baseline_policy?: "required" | "optional" | undefined;
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | null | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_revision?: number | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    trials?: number | undefined;
    est_tokens?: number | undefined;
}>, {
    description: string;
    id: string;
    leaderboard: "latest_session" | "rating";
    baseline_policy: "required" | "optional";
    scored_by: "local" | "author";
    protocol_revision: number;
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: {
        argv: string[];
        output: string;
    } | null | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    description: string;
    id: string;
    scored_by: "local" | "author";
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    baseline_policy?: "required" | "optional" | undefined;
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | null | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_revision?: number | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    trials?: number | undefined;
    est_tokens?: number | undefined;
}>, {
    score_policy: "required" | "author_fill";
    description: string;
    id: string;
    leaderboard: "latest_session" | "rating";
    baseline_policy: "required" | "optional";
    scored_by: "local" | "author";
    protocol_revision: number;
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    score_unit: string;
    trials: number;
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    command_template?: {
        argv: string[];
        output: string;
    } | null | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
        order: "desc" | "asc";
        label: string;
    } | undefined;
    judge_model?: string | undefined;
    judge_rubric?: string | undefined;
    scoring_note?: string | undefined;
    est_tokens?: number | undefined;
}, {
    description: string;
    id: string;
    scored_by: "local" | "author";
    name: string;
    category: "fun" | "useful";
    dimensions: ("幽默" | "语言" | "推理" | "代码" | "博弈" | "经营")[];
    interface: "chat" | "dialogue" | "agent";
    runner: "custom" | "builtin";
    scoring: "exact" | "custom" | "judge";
    tasks: {
        prompt: string;
        expected?: string | undefined;
        label?: string | undefined;
        id?: string | undefined;
        run_spec?: string | undefined;
        translation?: string | undefined;
        media?: {
            type: "image" | "video";
            src: string;
            alt: string;
            source_url?: string | undefined;
            caption?: string | undefined;
        }[] | undefined;
    }[];
    leaderboard?: "latest_session" | "rating" | undefined;
    baseline_policy?: "required" | "optional" | undefined;
    score_policy?: "required" | "author_fill" | undefined;
    command_template?: z.objectInputType<{
        argv: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
        output: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, string, string>;
    }, z.ZodTypeAny, "passthrough"> | null | undefined;
    custom_mode?: "executable" | "external_workflow" | undefined;
    hackathon_id?: string | undefined;
    protocol_revision?: number | undefined;
    protocol_note?: string | undefined;
    hook_title?: string | undefined;
    cover?: string | undefined;
    references?: {
        homepage?: string | undefined;
        paper?: string | undefined;
        repository?: string | undefined;
    } | undefined;
    upstream?: {
        repo: string;
        commit: string;
        paper?: string | undefined;
        contributors?: string[] | undefined;
    } | undefined;
    detail_profile?: {
        summary: {
            plain_language: string;
            why_it_matters: string;
        };
        source_kind: "evalhub_native" | "upstream_publication";
        method_steps: {
            title: string;
            description: string;
        }[];
        score_interpretation: string;
        caveats: {
            title: string;
            description: string;
        }[];
        resources: {
            title: string;
            summary: string;
            url: string;
        }[];
        overview_note?: string | undefined;
        key_facts?: {
            value: string;
            label: string;
            description?: string | undefined;
            source_url?: string | undefined;
        }[] | undefined;
        overview_tables?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            note: string;
            columns: {
                label: string;
                id: string;
            }[];
            rows: {
                id: string;
                cells: {
                    value: string | number;
                    column_id: string;
                }[];
            }[];
            caption?: string | undefined;
        }[] | undefined;
        figures?: {
            label: string;
            title: string;
            source_url: string;
            id: string;
            src: string;
            alt: string;
            caption: string;
            placement?: "overview" | "insights" | undefined;
        }[] | undefined;
        resources_note?: string | undefined;
    } | undefined;
    score_unit?: string | undefined;
    tiebreak?: {
        metric: "tiebreak_value";
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
export declare function resolveScorePolicy(value: Pick<EvalDefRefinementValue, "scored_by" | "score_policy">): "required" | "author_fill";
export declare function resolveCustomRunnerMode(value: Pick<EvalDefRefinementValue, "runner" | "custom_mode">): CustomRunnerMode | null;
export {};
