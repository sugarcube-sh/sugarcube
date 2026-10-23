import { type ForgeProvider, NotFoundError, repoRef } from "forges";
import type { GitHost } from "./git-host";

export type ForgeHostOptions = {
    readonly repository: string;
    readonly branch: string;
    readonly login: string;
};

export function forgeHost(
    forge: ForgeProvider,
    { repository, branch, login }: ForgeHostOptions,
): Omit<GitHost, "access"> {
    const repo = repoRef(forge, repository);
    return {
        latest: () => forge.contents.resolveRef(repo, branch),
        async file(commit, path) {
            try {
                const file = await forge.contents.getFile(repo, path, { ref: commit, as: "text" });
                return file.encoding === "utf-8"
                    ? file.content
                    : new TextDecoder().decode(file.content);
            } catch (error) {
                if (error instanceof NotFoundError) return undefined;
                throw error;
            }
        },
        async openPullRequest({ from, written, deleted, title, description }) {
            const head = pullRequestBranch(login, new Date());
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
        },
    };
}

export function pullRequestBranch(login: string, at: Date): string {
    const stamp = at.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    return `studio/${login}/${stamp}`;
}
