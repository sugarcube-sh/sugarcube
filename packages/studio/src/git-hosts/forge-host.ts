import {
    type ForgeProvider,
    ForgeNetworkError,
    ForgeTimeoutError,
    NotFoundError,
    RateLimitedError,
    repoRef,
} from "forges";
import { ErrorMessages } from "../error-messages";
import type { GitHost } from "./git-host";

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
    const plainly = inPlainWords(name);
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

export function inPlainWords(host: string) {
    return async <T>(run: () => Promise<T>): Promise<T> => {
        try {
            return await run();
        } catch (error) {
            throw worded(error, host);
        }
    };
}

function worded(error: unknown, host: string): unknown {
    if (error instanceof ForgeNetworkError || error instanceof ForgeTimeoutError)
        return new Error(ErrorMessages.COULD_NOT_REACH(host), { cause: error });
    if (error instanceof RateLimitedError) {
        const at = error.resetAt && clockTime(error.resetAt);
        return new Error(ErrorMessages.TOO_MANY_REQUESTS(at), { cause: error });
    }
    return error;
}

function clockTime(at: Date): string {
    const two = (n: number) => String(n).padStart(2, "0");
    return `${two(at.getHours())}:${two(at.getMinutes())}`;
}

export function pullRequestBranch(login: string, at: Date, tag: string): string {
    const stamp = at.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    return `studio/${login}/${stamp}-${tag}`;
}

function randomTag(): string {
    const [n = 0] = crypto.getRandomValues(new Uint16Array(1));
    return n.toString(16).padStart(4, "0");
}
