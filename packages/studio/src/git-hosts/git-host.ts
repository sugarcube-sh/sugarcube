import type { PullRequest } from "../protocol";

export interface GitHost {
    readonly name: string;
    readonly repository: string;
    readonly branch: string;
    getLatestCommit(): Promise<string>;
    getFile(commit: string, path: string): Promise<string | undefined>;
    getAccess(): Promise<Access>;
    openPullRequest(changes: PullRequestChanges): Promise<PullRequest>;
}

export type Access =
    | { can: "write" }
    | { can: "read" }
    | { can: "nothing"; reason: "no-access" }
    | { can: "nothing"; reason: "not-installed"; installURL?: string };

export class UnauthorizedError extends Error {
    override name = "UnauthorizedError";
}

export class AccessDeniedError extends Error {
    override name = "AccessDeniedError";
}

export type PullRequestChanges = {
    readonly baseCommit: string;
    readonly textByFile: Readonly<Record<string, string>>;
    readonly deleted: readonly string[];
    readonly title: string;
    readonly description: string;
};
