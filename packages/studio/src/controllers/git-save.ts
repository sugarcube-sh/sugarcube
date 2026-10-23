import { type Change, filePath, read } from "@sugarcube-sh/dtcg";
import { changedFiles } from "@sugarcube-sh/dtcg-edit";
import { ErrorMessages, UserFacingError } from "../error-messages";
import type { GitHost } from "../git-hosts/git-host";
import type { StudioSave } from "../protocol";
import { changeLines, changeText } from "./views";

export function gitSave({
    host,
    entry,
}: {
    host: Omit<GitHost, "access">;
    entry: string;
}): StudioSave {
    return async (edits, changes) => {
        const from = await host.latest();
        const fetched = await read(entry, { readText: (path) => host.file(from, path) }).catch(
            (error: unknown) => {
                throw error instanceof Error && error.cause !== undefined ? error.cause : error;
            },
        );
        if (fetched.text(fetched.entry) === undefined)
            throw new UserFacingError(
                ErrorMessages.ENTRY_NOT_THERE(entry, host.repository, host.branch),
            );
        const { files } = fetched.toMemory();
        const changed = changedFiles(fetched, edits);
        if (changed.conflicts) return { conflicts: changed.conflicts, files, changedOn: host.name };
        const pullRequest = await host.openPullRequest({
            from,
            written: Object.fromEntries(
                Object.entries(changed.written).map(([file, text]) => [
                    filePath(entry, file),
                    text,
                ]),
            ),
            deleted: changed.deleted.map((file) => filePath(entry, file)),
            ...pullRequestText(changes),
        });
        return { pullRequest, files };
    };
}

function pullRequestText(changes: readonly Change[]): {
    title: string;
    description: string;
} {
    const lines = changeLines(changes).map(changeText);
    return {
        title: lines.length === 1 ? (lines[0] ?? "") : `${lines.length} changes from studio`,
        description: lines.map((line) => `- ${line}`).join("\n"),
    };
}
