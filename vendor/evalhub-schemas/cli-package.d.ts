/**
 * Keep this value synchronized with packages/cli/package.json. The schemas
 * package owns brief generation, so it must render a concrete CLI package
 * spec without depending on the unpublished CLI package at runtime.
 */
export declare const CLI_PACKAGE_VERSION = "0.3.0";
export declare const CLI_PACKAGE_SPEC = "@evalhub/cli@0.3.0";
/**
 * Normalize the CLI package input used by older platform callers while
 * failing closed for tags, ranges, other versions, and shell syntax.
 */
export declare function exactCliPackageSpec(raw: string): string;
