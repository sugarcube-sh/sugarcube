import {
    AuthenticationRequiredError,
    ForbiddenError,
    type ForgeProvider,
    ForgeNetworkError,
    ForgeTimeoutError,
    InsufficientScopeError,
    NotFoundError,
    RateLimitedError,
    type RepoRef,
    TokenRevokedError,
    repoRef,
} from "forges";
import { ErrorMessages, UserFacingError } from "../error-messages";
import { STUDIO_BRANCH_PREFIX } from "../studio-names";
import { type GitHost, UnauthorizedError, AccessDeniedError } from "./git-host";

export type ForgeHostOptions = {
    readonly name: string;
    readonly repository: string;
    readonly branch: string;
    readonly login: string;
};

export function createForgeHost(
    forge: ForgeProvider,
    { name, repository, branch, login }: ForgeHostOptions,
): Omit<GitHost, "getAccess"> {
    const repo = repoRef(forge, repository);
    const withUserFacingErrors = createErrorWrapper(name, repo);
    return {
        name,
        repository,
        branch,
        getLatestCommit: () => withUserFacingErrors(() => forge.contents.resolveRef(repo, branch)),
        getFile: (commit, path) =>
            withUserFacingErrors(async () => {
                try {
                    const file = await forge.contents.getFile(repo, path, {
                        ref: commit,
                        as: "text",
                    });
                    return file.encoding === "utf-8"
                        ? file.content
                        : new TextDecoder().decode(file.content);
                } catch (error) {
                    if (error instanceof NotFoundError) return undefined;
                    throw error;
                }
            }),
        openPullRequest: ({ baseCommit, textByFile, deleted, title, description }) =>
            withUserFacingErrors(async () => {
                const head = formatBranchName(login, new Date(), createRandomTag());
                await forge.contents.commitFiles(repo, {
                    branch: head,
                    createFrom: baseCommit,
                    message: title,
                    changes: [
                        ...Object.entries(textByFile).map(([path, content]) => ({ path, content })),
                        ...deleted.map((path) => ({ path, content: null })),
                    ],
                });
                const pullRequest = await forge.threads.create(repo, {
                    kind: "pull_request",
                    title,
                    body: description,
                    head,
                    base: branch,
                });
                return { number: Number(pullRequest.ref.number), url: pullRequest.url };
            }),
    };
}

export function createErrorWrapper(host: string, repo: RepoRef) {
    return async <T>(run: () => Promise<T>): Promise<T> => {
        try {
            return await run();
        } catch (error) {
            throw toUserFacingError(error, host, repo);
        }
    };
}

function toUserFacingError(error: unknown, host: string, repo: RepoRef): unknown {
    const cause = { cause: error };
    if (error instanceof ForgeNetworkError || error instanceof ForgeTimeoutError)
        return new UserFacingError(ErrorMessages.HOST_UNREACHABLE(host), cause);
    if (error instanceof RateLimitedError) {
        const resetTime = error.resetAt && formatClockTime(error.resetAt);
        return new UserFacingError(ErrorMessages.TOO_MANY_REQUESTS(resetTime), cause);
    }
    if (error instanceof TokenRevokedError || error instanceof AuthenticationRequiredError)
        return new UnauthorizedError(error.message, cause);
    if (error instanceof InsufficientScopeError)
        return new UserFacingError(
            ErrorMessages.APP_LACKS_PERMISSION(`${repo.owner}/${repo.name}`),
            cause,
        );
    if (error instanceof ForbiddenError && error.reason === "sso_required")
        return new UserFacingError(ErrorMessages.SINGLE_SIGN_ON(repo.owner), cause);
    if (error instanceof ForbiddenError || error instanceof NotFoundError)
        return new AccessDeniedError(error.message, cause);
    return error;
}

function formatClockTime(date: Date): string {
    const padTwo = (n: number) => String(n).padStart(2, "0");
    return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

export function formatBranchName(login: string, date: Date, tag: string): string {
    const stamp = date.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    return `${STUDIO_BRANCH_PREFIX}/${login}/${stamp}-${tag}`;
}

function createRandomTag(): string {
    const [n = 0] = crypto.getRandomValues(new Uint16Array(1));
    return n.toString(16).padStart(4, "0");
}
