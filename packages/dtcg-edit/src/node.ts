import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type TokensOnDisk, getAbsoluteFilePath, read } from "@sugarcube-sh/dtcg/node";
import { getChangedFiles } from "./apply.js";
import type { ChangedFiles, Edits } from "./index.js";

/**
 * Applies edits to the token files on disk.
 *
 * Each file is read as it is now, so changes made since are kept. If any edit no longer applies,
 * nothing is written.
 *
 * @param source - Where the tokens are, such as `{ entryFile: "tokens/tokens.resolver.json" }`.
 * @param edits - The edits, such as {@link Session.unsavedEdits}.
 * @returns What {@link getChangedFiles} returns, for the files written.
 *
 * @example
 * // Save the shared color.primary set to {color.blue.300}
 * const saved = await applyToDisk({ entryFile: "tokens/tokens.resolver.json" }, session.unsavedEdits);
 * Object.keys(saved.textByFile ?? {})
 * // => ["color.json"]
 */
export async function applyToDisk(source: TokensOnDisk, edits: Edits): Promise<ChangedFiles> {
    const { entryFile, options } = source;
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
