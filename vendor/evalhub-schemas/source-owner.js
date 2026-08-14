const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/u;
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/u;
/**
 * Return the GitHub owner from an exact `owner/repository` identity.
 *
 * This deliberately rejects URLs, extra path segments, and malformed GitHub
 * handles so callers cannot accidentally treat a branch or issue URL as the
 * public eval author.
 */
export function githubOwnerFromRepositoryIdentity(value) {
    if (typeof value !== "string" || value !== value.trim()) {
        return null;
    }
    const pieces = value.split("/");
    if (pieces.length !== 2) {
        return null;
    }
    const [owner, repository] = pieces;
    if (!GITHUB_OWNER_PATTERN.test(owner ?? "") ||
        !GITHUB_REPOSITORY_PATTERN.test(repository ?? "") ||
        repository === "." ||
        repository === "..") {
        return null;
    }
    return owner;
}
/**
 * Return the GitHub owner from a repository homepage URL.
 *
 * Accepted forms are HTTPS github.com repository homepages, with an optional
 * `www` host, `.git` suffix, or one trailing slash. Sub-pages, credentials,
 * ports, query strings, and fragments are rejected.
 */
export function githubOwnerFromRepositoryUrl(value) {
    if (typeof value !== "string" || value !== value.trim()) {
        return null;
    }
    if (!/^https:\/\/(?:www\.)?github\.com\//iu.test(value)) {
        return null;
    }
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        return null;
    }
    if (parsed.protocol !== "https:" ||
        !["github.com", "www.github.com"].includes(parsed.hostname.toLowerCase()) ||
        parsed.port !== "" ||
        parsed.username !== "" ||
        parsed.password !== "" ||
        parsed.search !== "" ||
        parsed.hash !== "") {
        return null;
    }
    const pathMatch = /^\/([^/]+)\/([^/]+)\/?$/u.exec(parsed.pathname);
    if (pathMatch === null) {
        return null;
    }
    const [, owner, rawRepository] = pathMatch;
    const repository = rawRepository?.replace(/\.git$/iu, "");
    return githubOwnerFromRepositoryIdentity(`${owner ?? ""}/${repository ?? ""}`);
}
/**
 * Resolve the public eval author from source metadata.
 *
 * Explicit upstream metadata wins, followed by the repository reference URL,
 * then the explicitly supplied native eval repository.
 */
export function resolveEvalSourceOwnerHandle(input) {
    return (githubOwnerFromRepositoryIdentity(input.upstreamRepository) ??
        githubOwnerFromRepositoryUrl(input.referenceRepositoryUrl) ??
        githubOwnerFromRepositoryIdentity(input.nativeRepository));
}
