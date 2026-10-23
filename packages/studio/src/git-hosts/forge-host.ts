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
import { type GitHost, KeyRefused, Refused } from "./git-host";

export type ForgeHostOptions = {
    readonly name: string;
    readonly repository: string;
    readonly branch: string;
    readonly login: string;
};

export function forgeHost(
    forge: ForgeProvider,
    { name, repository, branch, login }: ForgeHostOptions,
): Omit<GitHost, "access"> {
    const repo = repoRef(forge, repository);
    const plainly = inPlainWords(name, repo);
    return {
        name,
        repository,
        branch,
        latest: () => plainly(() => forge.contents.resolveRef(repo, branch)),
        file: (commit, path) =>
            plainly(async () => {
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
        openPullRequest: ({ from, written, deleted, title, description }) =>
            plainly(async () => {
                const head = pullRequestBranch(login, new Date(), randomTag());
                await forge.contents.commitFiles(repo, {
                    branch: head,
                    createFrom: from,
                    message: title,
                    changes: [
                        ...Object.entries(written).map(([path, content]) => ({ path, content })),
                        ...deleted.map((path) => ({ path, content: null })),
                    ],
                });
                const pull = await forge.threads.create(repo, {
                    kind: "pull_request",
                    title,
                    body: description,
                    head,
                    base: branch,
                });
                return { number: Number(pull.ref.number), url: pull.url };
            }),
    };
}

export function inPlainWords(host: string, repo: RepoRef) {
    return async <T>(run: () => Promise<T>): Promise<T> => {
        try {
            return await run();
        } catch (error) {
            throw worded(error, host, repo);
        }
    };
}

function worded(error: unknown, host: string, repo: RepoRef): unknown {
    const cause = { cause: error };
    if (error instanceof ForgeNetworkError || error instanceof ForgeTimeoutError)
        return new UserFacingError(ErrorMessages.COULD_NOT_REACH(host), cause);
    if (error instanceof RateLimitedError) {
        const at = error.resetAt && clockTime(error.resetAt);
        return new UserFacingError(ErrorMessages.TOO_MANY_REQUESTS(at), cause);
    }
    if (error instanceof TokenRevokedError || error instanceof AuthenticationRequiredError)
        return new KeyRefused(error.message, cause);
    if (error instanceof InsufficientScopeError)
        return new UserFacingError(
            ErrorMessages.APP_LACKS_PERMISSION(`${repo.owner}/${repo.name}`),
            cause,
        );
    if (error instanceof ForbiddenError && error.reason === "sso_required")
        return new UserFacingError(ErrorMessages.SINGLE_SIGN_ON(repo.owner), cause);
    if (error instanceof ForbiddenError || error instanceof NotFoundError)
        return new Refused(error.message, cause);
    return error;
}

function clockTime(at: Date): string {
    const two = (n: number) => String(n).padStart(2, "0");
    return `${two(at.getHours())}:${two(at.getMinutes())}`;
}

export function pullRequestBranch(login: string, at: Date, tag: string): string {
    const stamp = at.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    return `${STUDIO_BRANCH_PREFIX}/${login}/${stamp}-${tag}`;
}

function randomTag(): string {
    const [n = 0] = crypto.getRandomValues(new Uint16Array(1));
    return n.toString(16).padStart(4, "0");
}
