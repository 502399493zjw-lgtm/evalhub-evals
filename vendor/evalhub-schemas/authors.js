export const EVAL_AUTHORS_PLACEHOLDER = "@TODO-github-handle";
export const EVAL_AUTHORS_HANDLE_PATTERN = /^@[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/u;
/**
 * Parse the repository AUTHORS file used as an eval's published owner.
 *
 * Empty and comment-only lines are metadata; exactly one remaining line must
 * contain a syntactically valid GitHub user or organization handle. The
 * returned handle omits the leading `@` while preserving display casing.
 */
export function parseEvalAuthorsText(source) {
    const meaningfulLines = source
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"));
    if (meaningfulLines.length !== 1) {
        return {
            success: false,
            code: "expected_one_handle",
            message: `expected exactly one meaningful GitHub handle line; found ${meaningfulLines.length}`,
        };
    }
    const author = meaningfulLines[0];
    if (author === EVAL_AUTHORS_PLACEHOLDER) {
        return {
            success: false,
            code: "placeholder",
            message: `${EVAL_AUTHORS_PLACEHOLDER} is a scaffold placeholder`,
        };
    }
    if (!EVAL_AUTHORS_HANDLE_PATTERN.test(author)) {
        return {
            success: false,
            code: "invalid_handle",
            message: "meaningful line must be one GitHub handle matching /^@[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/",
        };
    }
    return { success: true, handle: author.slice(1) };
}
