const CJK_PATTERN = /[\u3400-\u9fff]/u;
const CJK_GLOBAL_PATTERN = /[\u3400-\u9fff]/gu;
const LATIN_PATTERN = /[A-Za-z]/gu;
const PLACEHOLDER_PATTERN = /(?:\bTODO\b|\bplaceholder\b|待补|占位|测试测试|中文说明)/iu;
const SCORE_PATTERN = /(?:分数|成绩|得分|结果|通过率|成功率|准确率|排名|奖励|score|result|accuracy|pass\s*rate)/iu;
const SCORE_RELATION_PATTERN = /(?:表示|意味着|反映|体现|代表|越高|越低|越好|越差|达到|通过|成功|失败|indicat(?:e|es)|means|reflects?|higher|lower)/iu;
const TASK_ACTION_PATTERN = /(?:请|需要|要|目标|任务|完成|回答|作答|判断|找出|写出|生成|选择|操作|检查|验证|识别|阅读|提交|修复|实现|比较|分析|测试|测量|评估|考察|计算|提取|分类|预测|翻译|编写|执行|解决|create|answer|generate|classify|extract|compare|predict|translate|fix|complete|solve)/iu;
const TASK_INPUT_PATTERN = /(?:给出|给定|提供|输入|材料|题目|文本|图片|表格|网页|网站|文件|代码|仓库|对话|请求|信息|数据|这份|这段|这个|这些|以下|根据|看到|阅读|input|given|provided|prompt|text|code|task|data)/iu;
const TASK_SUCCESS_PATTERN = /(?:成功|算完成|完成条件|通过|符合|满足|正确|准确|达到|要求|条件|标准|检查无误|验证无误|预期|得分|success|correct|pass|expected|criteria|score)/iu;
const TECHNICAL_TERM_PATTERN = /(?:LLM|Agent|API|RAG|benchmark|pipeline|schema|protocol|模型|智能体|接口|协议|基准|指标|向量|推理链|工作流)/giu;
const PLAIN_LANGUAGE_CONNECTOR_PATTERN = /(?:也就是|换句话说|简单来说|例如|让普通读者|帮助.*了解|表示|意味着|要做|会给|怎样|如何|为什么|从而|因此)/u;
const MIN_CJK_PER_KIND = {
    short: 2,
    prose: 6,
    task: 12,
};
const SPARSE_CHINESE_LATIN_THRESHOLD = 40;
export function hasChineseText(value) {
    return CJK_PATTERN.test(value);
}
function chineseCharacterCount(value) {
    return [...value.matchAll(CJK_GLOBAL_PATTERN)].length;
}
function latinCharacterCount(value) {
    return [...value.matchAll(LATIN_PATTERN)].length;
}
function hasMeaninglessRepetition(value) {
    const cjk = value.match(CJK_GLOBAL_PATTERN)?.join("") ?? "";
    if (cjk.length < 6)
        return false;
    const uniqueRatio = new Set(cjk).size / cjk.length;
    if (uniqueRatio < 0.22)
        return true;
    for (let unitLength = 1; unitLength <= 4; unitLength += 1) {
        if (cjk.length < unitLength * 3 || cjk.length % unitLength !== 0) {
            continue;
        }
        const unit = cjk.slice(0, unitLength);
        if (unit.repeat(cjk.length / unitLength) === cjk)
            return true;
    }
    return false;
}
function isTechnicalTermPile(value) {
    const terms = value.match(TECHNICAL_TERM_PATTERN) ?? [];
    return (terms.length >= 4 &&
        !TASK_ACTION_PATTERN.test(value) &&
        !PLAIN_LANGUAGE_CONNECTOR_PATTERN.test(value));
}
function hasChineseQuality(value, kind, purpose) {
    const normalized = value.trim().replace(/[\s\p{P}\p{S}]+/gu, "");
    if (normalized.length === 0)
        return "missing";
    if (PLACEHOLDER_PATTERN.test(value) || hasMeaninglessRepetition(normalized)) {
        return "placeholder";
    }
    const chineseCount = chineseCharacterCount(value);
    if (chineseCount < MIN_CJK_PER_KIND[kind])
        return "no_chinese";
    if (kind === "short")
        return null;
    const latinCount = latinCharacterCount(value);
    if (latinCount >= SPARSE_CHINESE_LATIN_THRESHOLD &&
        chineseCount * 5 < latinCount) {
        return "mostly_english";
    }
    if (isTechnicalTermPile(value))
        return "technical_term_pile";
    if (purpose === "score") {
        return SCORE_PATTERN.test(value) && SCORE_RELATION_PATTERN.test(value)
            ? null
            : "no_chinese";
    }
    if (purpose === "task") {
        return TASK_ACTION_PATTERN.test(value) &&
            TASK_INPUT_PATTERN.test(value) &&
            TASK_SUCCESS_PATTERN.test(value)
            ? null
            : "no_chinese";
    }
    if (purpose === "eval_what" || purpose === "why_it_matters") {
        return TASK_ACTION_PATTERN.test(value) ? null : "no_chinese";
    }
    return null;
}
export function validateReaderCopy(fields, options = {}) {
    const requiredFields = new Set(options.requiredFields ??
        fields
            .filter((field) => field.required !== false)
            .map((field) => field.key));
    const issues = [];
    const seen = new Set();
    for (const field of fields) {
        const path = field.path ?? [field.key];
        if (seen.has(field.key)) {
            issues.push({
                code: "duplicate_field",
                field: field.key,
                path,
                message: `用户展示字段 ${field.key} 重复声明`,
            });
            continue;
        }
        seen.add(field.key);
        const required = requiredFields.has(field.key);
        if (field.value === undefined || field.value.trim().length === 0) {
            if (required) {
                issues.push({
                    code: "missing",
                    field: field.key,
                    path,
                    message: `用户展示字段 ${field.key} 不能为空`,
                });
            }
            continue;
        }
        const code = hasChineseQuality(field.value, field.kind ?? "prose", field.purpose ?? "generic");
        if (code === null || !required)
            continue;
        issues.push({
            code,
            field: field.key,
            path,
            message: code === "placeholder"
                ? `用户展示字段 ${field.key} 仍包含待替换的占位内容`
                : code === "mostly_english"
                    ? `用户展示字段 ${field.key} 不能主要由英文或技术名词组成，请补充通俗中文说明`
                    : code === "technical_term_pile"
                        ? `用户展示字段 ${field.key} 不能只堆砌技术术语，请补充普通读者能理解的说明`
                        : `用户展示字段 ${field.key} 需要提供完整的中文说明`,
        });
    }
    for (const key of requiredFields) {
        if (seen.has(key))
            continue;
        issues.push({
            code: "missing",
            field: key,
            path: [key],
            message: `用户展示字段 ${key} 未提供`,
        });
    }
    return { ok: issues.length === 0, issues };
}
function pushEvalField(fields, key, value, path, options = {}) {
    fields.push({ key, value, path, ...options });
}
export function validateEvalReaderCopy(definition, options = {}) {
    const fields = [];
    const profile = definition.detail_profile;
    pushEvalField(fields, "eval.name", definition.name, ["name"], {
        kind: "short",
    });
    pushEvalField(fields, "eval.description", definition.description, ["description"], {
        purpose: "eval_what",
    });
    if (definition.hook_title !== undefined) {
        pushEvalField(fields, "eval.hook_title", definition.hook_title, ["hook_title"], {
            kind: "short",
        });
    }
    if (profile !== undefined) {
        if ("markdown" in profile) {
            pushEvalField(fields, "detail_profile.markdown", profile.markdown, ["detail_profile", "markdown"]);
        }
        else {
            pushEvalField(fields, "detail_profile.summary.plain_language", profile.summary.plain_language, ["detail_profile", "summary", "plain_language"], { purpose: "eval_what" });
            pushEvalField(fields, "detail_profile.summary.why_it_matters", profile.summary.why_it_matters, ["detail_profile", "summary", "why_it_matters"], { purpose: "why_it_matters" });
            pushEvalField(fields, "detail_profile.score_interpretation", profile.score_interpretation, ["detail_profile", "score_interpretation"], { purpose: "score" });
            if (profile.overview_note !== undefined) {
                pushEvalField(fields, "detail_profile.overview_note", profile.overview_note, [
                    "detail_profile",
                    "overview_note",
                ]);
            }
            if (profile.resources_note !== undefined) {
                pushEvalField(fields, "detail_profile.resources_note", profile.resources_note, [
                    "detail_profile",
                    "resources_note",
                ]);
            }
            for (const [index, step] of profile.method_steps.entries()) {
                pushEvalField(fields, `detail_profile.method_steps.${index}.title`, step.title, [
                    "detail_profile",
                    "method_steps",
                    index,
                    "title",
                ], { kind: "short" });
                pushEvalField(fields, `detail_profile.method_steps.${index}.description`, step.description, ["detail_profile", "method_steps", index, "description"]);
            }
            for (const [index, caveat] of profile.caveats.entries()) {
                pushEvalField(fields, `detail_profile.caveats.${index}.title`, caveat.title, [
                    "detail_profile",
                    "caveats",
                    index,
                    "title",
                ], { kind: "short" });
                pushEvalField(fields, `detail_profile.caveats.${index}.description`, caveat.description, [
                    "detail_profile",
                    "caveats",
                    index,
                    "description",
                ]);
            }
            for (const [index, fact] of (profile.key_facts ?? []).entries()) {
                pushEvalField(fields, `detail_profile.key_facts.${index}.label`, fact.label, [
                    "detail_profile",
                    "key_facts",
                    index,
                    "label",
                ], { kind: "short" });
                if (fact.description !== undefined) {
                    pushEvalField(fields, `detail_profile.key_facts.${index}.description`, fact.description, [
                        "detail_profile",
                        "key_facts",
                        index,
                        "description",
                    ]);
                }
            }
            for (const [index, resource] of profile.resources.entries()) {
                pushEvalField(fields, `detail_profile.resources.${index}.title`, resource.title, [
                    "detail_profile",
                    "resources",
                    index,
                    "title",
                ], { kind: "short" });
                pushEvalField(fields, `detail_profile.resources.${index}.summary`, resource.summary, [
                    "detail_profile",
                    "resources",
                    index,
                    "summary",
                ]);
            }
            for (const [index, figure] of (profile.figures ?? []).entries()) {
                for (const [key, value, kind] of [
                    ["label", figure.label, "short"],
                    ["title", figure.title, "short"],
                    ["alt", figure.alt, "prose"],
                    ["caption", figure.caption, "prose"],
                ]) {
                    pushEvalField(fields, `detail_profile.figures.${index}.${key}`, value, [
                        "detail_profile",
                        "figures",
                        index,
                        key,
                    ], { kind });
                }
            }
            for (const [tableIndex, table] of (profile.overview_tables ?? []).entries()) {
                pushEvalField(fields, `detail_profile.overview_tables.${tableIndex}.label`, table.label, [
                    "detail_profile",
                    "overview_tables",
                    tableIndex,
                    "label",
                ], { kind: "short" });
                pushEvalField(fields, `detail_profile.overview_tables.${tableIndex}.title`, table.title, [
                    "detail_profile",
                    "overview_tables",
                    tableIndex,
                    "title",
                ], { kind: "short" });
                pushEvalField(fields, `detail_profile.overview_tables.${tableIndex}.note`, table.note, [
                    "detail_profile",
                    "overview_tables",
                    tableIndex,
                    "note",
                ]);
                if (table.caption !== undefined) {
                    pushEvalField(fields, `detail_profile.overview_tables.${tableIndex}.caption`, table.caption, [
                        "detail_profile",
                        "overview_tables",
                        tableIndex,
                        "caption",
                    ]);
                }
                for (const [columnIndex, column] of table.columns.entries()) {
                    pushEvalField(fields, `detail_profile.overview_tables.${tableIndex}.columns.${columnIndex}.label`, column.label, [
                        "detail_profile",
                        "overview_tables",
                        tableIndex,
                        "columns",
                        columnIndex,
                        "label",
                    ], { kind: "short" });
                }
            }
        }
    }
    if (!options.allowLegacyTasks) {
        for (const [index, task] of definition.tasks.entries()) {
            pushEvalField(fields, `tasks.${index}.label`, task.label, ["tasks", index, "label"], {
                kind: "short",
            });
            const explanation = task.translation ?? task.prompt;
            pushEvalField(fields, `tasks.${index}.reader_explanation`, explanation, ["tasks", index, task.translation !== undefined ? "translation" : "prompt"], { kind: "task", purpose: "task" });
        }
    }
    const generic = validateReaderCopy(fields);
    const issues = generic.issues.map((issue) => ({
        ...issue,
        field: issue.field,
    }));
    if (!options.allowLegacyTasks) {
        for (const [index, task] of definition.tasks.entries()) {
            const explanation = task.translation ?? task.prompt;
            if (explanation === undefined || explanation.trim().length === 0) {
                issues.push({
                    code: "task_explanation_missing",
                    field: `tasks.${index}.reader_explanation`,
                    path: ["tasks", index, "translation"],
                    message: "每道任务都必须提供面向读者的中文说明，说明要完成什么、处理什么输入，以及什么条件算成功",
                });
            }
            else if (!TASK_ACTION_PATTERN.test(explanation) ||
                !TASK_INPUT_PATTERN.test(explanation) ||
                !TASK_SUCCESS_PATTERN.test(explanation)) {
                issues.push({
                    code: "task_explanation_incomplete",
                    field: `tasks.${index}.reader_explanation`,
                    path: [
                        "tasks",
                        index,
                        task.translation !== undefined ? "translation" : "prompt",
                    ],
                    message: "任务中文说明需要同时交代要做什么、处理什么输入，以及满足什么条件算成功",
                });
            }
        }
    }
    return { ok: issues.length === 0, issues };
}
