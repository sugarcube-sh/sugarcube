import { type Change, getFilePath, read } from "@sugarcube-sh/dtcg";
import { getChangedFiles } from "@sugarcube-sh/dtcg-edit";
import { ErrorMessages, UserFacingError } from "../error-messages";
import type { GitHost } from "../git-hosts/git-host";
import type { StudioSave } from "../protocol";
import { toChangeLines, formatChange } from "./views";

export function createGitSave({
    host,
    entry,
}: {
    host: Omit<GitHost, "getAccess">;
    entry: string;
}): StudioSave {
    return async (edits, changes) => {
        const latestCommit = await host.getLatestCommit();
        const remoteTokens = await read(entry, {
            readText: (path) => host.getFile(latestCommit, path),
        }).catch((error: unknown) => {
            throw error instanceof Error && error.cause !== undefined ? error.cause : error;
        });
        if (remoteTokens.getText(remoteTokens.entryFile) === undefined)
            throw new UserFacingError(
                ErrorMessages.ENTRY_NOT_FOUND(entry, host.repository, host.branch),
            );
        const { files } = remoteTokens.toMemory();
        const changedFiles = getChangedFiles(remoteTokens, edits);
        if (changedFiles.conflicts)
            return { conflicts: changedFiles.conflicts, files, changedHost: host.name };
        const pullRequest = await host.openPullRequest({
            baseCommit: latestCommit,
            textByFile: Object.fromEntries(
                Object.entries(changedFiles.textByFile).map(([file, text]) => [
                    getFilePath(entry, file),
                    text,
                ]),
            ),
            deleted: changedFiles.deleted.map((file) => getFilePath(entry, file)),
            ...formatPullRequestText(changes),
        });
        return { pullRequest, files };
    };
}

function formatPullRequestText(changes: readonly Change[]): {
    title: string;
    description: string;
} {
    const lines = toChangeLines(changes).map(formatChange);
    return {
        title:
            lines.length === 1 ? (lines[0] ?? "") : ErrorMessages.PULL_REQUEST_TITLE(lines.length),
        description: lines.map((line) => `- ${line}`).join("\n"),
    };
}
