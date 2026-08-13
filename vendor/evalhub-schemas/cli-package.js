const CLI_PACKAGE_NAME = "@evalhub/cli";
/**
 * Keep this value synchronized with packages/cli/package.json. The schemas
 * package owns brief generation, so it must render a concrete CLI package
 * spec without depending on the unpublished CLI package at runtime.
 */
export const CLI_PACKAGE_VERSION = "0.3.0";
export const CLI_PACKAGE_SPEC = `${CLI_PACKAGE_NAME}@${CLI_PACKAGE_VERSION}`;
/**
 * Normalize the CLI package input used by older platform callers while
 * failing closed for tags, ranges, other versions, and shell syntax.
 */
export function exactCliPackageSpec(raw) {
    const value = raw.trim();
    if (value === CLI_PACKAGE_NAME || value === CLI_PACKAGE_SPEC) {
        return CLI_PACKAGE_SPEC;
    }
    throw new Error(`cliPackageSpec must be exactly ${CLI_PACKAGE_SPEC}`);
}
