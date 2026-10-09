import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Document, ReadOptions } from "../index.js";
import { filePath, folderOf } from "../read/paths.js";
import { read as readAnywhere } from "../read/read.js";

/**
 * Reads a design system from disk. Paths in the result are relative to the entry's folder: join
 * them with it to reach a file on disk.
 *
 * @example
 * const doc = await read("tokens/tokens.resolver.json");
 */
export function read(entry: string, options: ReadOptions = {}): Promise<Document> {
    return readAnywhere(slashed(entry), { ...options, readText: (file) => readFile(file, "utf8") });
}

export function fileOnDisk(entry: string, file: string): string {
    return diskPath(filePath(folderOf(slashed(entry)), file));
}

export function diskPath(path: string): string {
    return slashed(resolve(slashed(path)));
}

function slashed(path: string): string {
    return path.replaceAll("\\", "/");
}
