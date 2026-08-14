export type EvalSourceOwnerInput = {
    upstreamRepository?: string | null;
    referenceRepositoryUrl?: string | null;
    nativeRepository?: string | null;
};
/**
 * Return the GitHub owner from an exact `owner/repository` identity.
 *
 * This deliberately rejects URLs, extra path segments, and malformed GitHub
 * handles so callers cannot accidentally treat a branch or issue URL as the
 * public eval author.
 */
export declare function githubOwnerFromRepositoryIdentity(value: unknown): string | null;
/**
 * Return the GitHub owner from a repository homepage URL.
 *
 * Accepted forms are HTTPS github.com repository homepages, with an optional
 * `www` host, `.git` suffix, or one trailing slash. Sub-pages, credentials,
 * ports, query strings, and fragments are rejected.
 */
export declare function githubOwnerFromRepositoryUrl(value: unknown): string | null;
/**
 * Resolve the public eval author from source metadata.
 *
 * Explicit upstream metadata wins, followed by the repository reference URL,
 * then the explicitly supplied native eval repository.
 */
export declare function resolveEvalSourceOwnerHandle(input: EvalSourceOwnerInput): string | null;
