export declare const EVAL_MAINTAINER_PLACEHOLDER = "@TODO-github-handle";
export declare const EVAL_MAINTAINER_HANDLE_PATTERN: RegExp;
export type EvalMaintainerParseErrorCode = "expected_one_handle" | "placeholder" | "invalid_handle";
export type EvalMaintainerParseResult = {
    success: true;
    handle: string;
} | {
    success: false;
    code: EvalMaintainerParseErrorCode;
    message: string;
};
/**
 * Parse the repository AUTHORS file used as an eval's maintainer.
 *
 * Empty and comment-only lines are metadata; exactly one remaining line must
 * contain a syntactically valid GitHub user handle. The returned handle omits
 * the leading `@` while preserving display casing.
 */
export declare function parseEvalMaintainerText(source: string): EvalMaintainerParseResult;
/** @deprecated Use EVAL_MAINTAINER_PLACEHOLDER. */
export declare const EVAL_AUTHORS_PLACEHOLDER = "@TODO-github-handle";
/** @deprecated Use EVAL_MAINTAINER_HANDLE_PATTERN. */
export declare const EVAL_AUTHORS_HANDLE_PATTERN: RegExp;
/** @deprecated Use EvalMaintainerParseErrorCode. */
export type EvalAuthorsParseErrorCode = EvalMaintainerParseErrorCode;
/** @deprecated Use EvalMaintainerParseResult. */
export type EvalAuthorsParseResult = EvalMaintainerParseResult;
/** @deprecated Use parseEvalMaintainerText. */
export declare const parseEvalAuthorsText: typeof parseEvalMaintainerText;
