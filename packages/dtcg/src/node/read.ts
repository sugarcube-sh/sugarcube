import { readFile } from "node:fs/promises";
import { sep } from "node:path";
import type { Document, ReadOptions } from "../index.js";
import { read as readAnywhere } from "../read/read.js";

/**
 * Reads a design system from disk. Paths in the result are relative to the entry's folder: join
 * them with it to reach a file on disk.
 *
 * @example
 * const doc = await read("tokens/tokens.resolver.json");
 */
export function read(entry: string, options: ReadOptions = {}): Promise<Document> {
    const path = sep === "\\" ? entry.replaceAll("\\", "/") : entry;
    return readAnywhere(path, { ...options, readText: (file) => readFile(file, "utf8") });
}
