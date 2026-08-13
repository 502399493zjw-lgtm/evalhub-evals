export declare const EVAL_AUTHORS_PLACEHOLDER = "@TODO-github-handle";
export declare const EVAL_AUTHORS_HANDLE_PATTERN: RegExp;
export type EvalAuthorsParseErrorCode = "expected_one_handle" | "placeholder" | "invalid_handle";
export type EvalAuthorsParseResult = {
    success: true;
    handle: string;
} | {
    success: false;
    code: EvalAuthorsParseErrorCode;
    message: string;
};
/**
 * Parse the repository AUTHORS file used as an eval's published owner.
 *
 * Empty and comment-only lines are metadata; exactly one remaining line must
 * contain a syntactically valid GitHub user or organization handle. The
 * returned handle omits the leading `@` while preserving display casing.
 */
export declare function parseEvalAuthorsText(source: string): EvalAuthorsParseResult;
