import type { PullRequest } from "../protocol";

export interface GitHost {
    readonly name: string;
    readonly repository: string;
    readonly branch: string;
    latest(): Promise<string>;
    file(commit: string, path: string): Promise<string | undefined>;
    access(): Promise<Access>;
    openPullRequest(changes: PullRequestChanges): Promise<PullRequest>;
}

export type Access =
    | { can: "write" }
    | { can: "read" }
    | { can: "nothing"; reason: "no-access" }
    | { can: "nothing"; reason: "not-installed"; install?: string };

export class KeyRefused extends Error {
    override name = "KeyRefused";
}

export class Refused extends Error {
    override name = "Refused";
}

export type PullRequestChanges = {
    readonly from: string;
    readonly written: Readonly<Record<string, string>>;
    readonly deleted: readonly string[];
    readonly title: string;
    readonly description: string;
};
