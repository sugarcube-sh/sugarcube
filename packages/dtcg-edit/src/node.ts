import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type TokensOnDisk, getAbsoluteFilePath, read } from "@sugarcube-sh/dtcg/node";
import { getChangedFiles } from "./apply.js";
import type { ChangedFiles, Edits } from "./index.js";

/**
 * Applies edits to the files of design tokens on disk, given by their resolver or token file and
 * the options they are read with, as `createLiveTokens` takes them. Each file is read as it is now, so
 * changes made there in the meantime are kept; an edit that no longer applies, as {@link apply}
 * decides, is returned as a conflict, and so is an edit to a file the design tokens aren't read
 * from, such as `package.json`, or a new file nothing reads.
 *
 * Every edit is applied in memory before any file is written, so if one fails, nothing is
 * written. Each file is written to a temporary copy and then renamed into place, so no file is
 * left half-written. Gives back what {@link getChangedFiles} gives: the design tokens as read from
 * the files written, each file written with its new text, and the files deleted.
 *
 * @example
 * const onDisk = { entryFile: "tokens/tokens.resolver.json", options };
 * const saved = await applyToDisk(onDisk, session.unsavedEdits);
 * if (saved.tokens) {
 *     session.markSaved();
 *     session.rebase(saved.tokens);
 * }
 */
export async function applyToDisk(
    { entryFile, options }: TokensOnDisk,
    edits: Edits,
): Promise<ChangedFiles> {
    const changes = getChangedFiles(await read(entryFile, options), edits);
    if (changes.conflicts) return changes;

    const { textByFile: written, deleted } = changes;
    await replaceFiles(
        Object.entries(written).map(([file, text]) => [getAbsoluteFilePath(entryFile, file), text]),
    );
    await Promise.all(
        deleted.map((file) => rm(getAbsoluteFilePath(entryFile, file), { force: true })),
    );
    return changes;
}

async function replaceFiles(files: [path: string, text: string][]): Promise<void> {
    const tempFiles = files.map(([path, text]) => ({
        path,
        text,
        tempPath: `${path}.${randomUUID()}.tmp`,
    }));
    const createdFolders: string[] = [];
    try {
        for (const { path, text, tempPath: copy } of tempFiles) {
            const folder = await mkdir(dirname(path), { recursive: true });
            if (folder) createdFolders.push(folder);
            await writeFile(copy, text, "utf8");
        }
        for (const { tempPath: copy, path } of tempFiles) await rename(copy, path);
    } catch (error) {
        await Promise.allSettled(tempFiles.map(({ tempPath: copy }) => rm(copy, { force: true })));
        await Promise.allSettled(
            createdFolders.map((folder) => rm(folder, { recursive: true, force: true })),
        );
        throw error;
    }
}
