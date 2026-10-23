import type { PullRequest } from "../protocol";

export interface GitHost {
    latest(): Promise<string>;
    file(commit: string, path: string): Promise<string | undefined>;
    access(): Promise<Access>;
    openPullRequest(changes: PullRequestChanges): Promise<PullRequest>;
}

export type Access = { can: "write" } | { can: "read" } | { can: "nothing"; install?: string };

export type PullRequestChanges = {
    readonly from: string;
    readonly written: Readonly<Record<string, string>>;
    readonly deleted: readonly string[];
    readonly title: string;
    readonly description: string;
};
