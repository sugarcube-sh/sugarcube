import { readFile } from "node:fs/promises";
import type { DesignTokens, ReadOptions } from "../index.js";
import { read as readAnywhere } from "../read/read.js";
import { slashed } from "./paths.js";

/**
 * Reads design tokens from disk. Paths in the result are relative to the entry's folder: join
 * them with it to reach a file on disk.
 *
 * @example
 * const tokens = await read("tokens/tokens.resolver.json");
 */
export function read(entry: string, options: ReadOptions = {}): Promise<DesignTokens> {
    return readAnywhere(slashed(entry), {
        ...options,
        readText: textOnDisk,
    });
}

export async function textOnDisk(file: string): Promise<string | undefined> {
    try {
        return await readFile(file, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
    }
}
