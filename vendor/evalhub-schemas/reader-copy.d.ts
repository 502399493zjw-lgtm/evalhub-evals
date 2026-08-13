import type { EvalDef } from "./eval-def.js";
declare const MIN_CJK_PER_KIND: {
    readonly short: 2;
    readonly prose: 6;
    readonly task: 12;
};
export type ReaderCopyKind = keyof typeof MIN_CJK_PER_KIND;
export type ReaderCopyPurpose = "generic" | "eval_what" | "why_it_matters" | "score" | "task";
export type ReaderCopyField = {
    key: string;
    value: string | undefined;
    path?: readonly (string | number)[];
    kind?: ReaderCopyKind;
    purpose?: ReaderCopyPurpose;
    required?: boolean;
};
export type ReaderCopyValidationOptions = {
    requiredFields?: readonly string[];
};
export type ReaderCopyIssueCode = "missing" | "no_chinese" | "mostly_english" | "placeholder" | "technical_term_pile" | "duplicate_field";
export type ReaderCopyIssue = {
    code: ReaderCopyIssueCode;
    field: string;
    path: readonly (string | number)[];
    message: string;
};
export type ReaderCopyValidationResult = {
    ok: boolean;
    issues: ReaderCopyIssue[];
};
export type EvalReaderCopyIssueCode = ReaderCopyIssueCode | "score_explanation" | "task_explanation_missing" | "task_explanation_incomplete";
export type EvalReaderCopyIssue = {
    code: EvalReaderCopyIssueCode;
    field: string;
    path: readonly (string | number)[];
    message: string;
};
export type EvalReaderCopyValidationResult = {
    ok: boolean;
    issues: EvalReaderCopyIssue[];
};
export type EvalReaderCopyValidationOptions = {
    allowLegacyTasks?: boolean;
};
export declare function hasChineseText(value: string): boolean;
export declare function validateReaderCopy(fields: readonly ReaderCopyField[], options?: ReaderCopyValidationOptions): ReaderCopyValidationResult;
export declare function validateEvalReaderCopy(definition: EvalDef, options?: EvalReaderCopyValidationOptions): EvalReaderCopyValidationResult;
export {};
