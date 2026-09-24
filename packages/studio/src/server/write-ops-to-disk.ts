import { readFile, writeFile } from "node:fs/promises";
import { type FileWriteOp, applyWriteOps } from "../tokens/write-ops";

export type FileText = {
    read: (path: string) => Promise<string>;
    write: (path: string, text: string) => Promise<void>;
};

export const nodeFileText: FileText = {
    read: (path) => readFile(path, "utf-8"),
    write: (path, text) => writeFile(path, text, "utf-8"),
};

/**
 * Replays each file's operations against the text on disk, then writes. Every
 * file is applied before any is written, so a rename that fails on one file
 * leaves none of them half-renamed (D-043).
 */
export async function writeOpsToDisk(
    io: FileText,
    files: Array<{ path: string; ops: FileWriteOp[] }>,
): Promise<void> {
    const texts = await Promise.all(files.map((file) => io.read(file.path)));
    const written = files.map((file, index) => ({
        path: file.path,
        text: applyWriteOps(texts[index] as string, file.ops, file.path),
    }));

    for (const { path, text } of written) await io.write(path, text);
}
