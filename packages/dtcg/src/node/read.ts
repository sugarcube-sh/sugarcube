import { readFile } from "node:fs/promises";
import type { DesignTokens } from "../model/design-tokens.js";
import type { ReadOptions } from "../model/read-options.js";
import { read as readAnywhere } from "../read/read.js";
import { toPosixPath } from "./paths.js";

/**
 * Reads design tokens from disk.
 *
 * For a file's full path on disk, use {@link getAbsoluteFilePath}.
 *
 * @param entry - The resolver or token file, such as `"tokens/tokens.resolver.json"`.
 * @param options - How to read them, from {@link ReadOptions}.
 *
 * @example
 * // A resolver and its files
 * const tokens = await read("tokens/tokens.resolver.json");
 * tokens.files
 * // => ["tokens.resolver.json", "color.json", "dark.json"]
 */
export function read(entry: string, options: ReadOptions = {}): Promise<DesignTokens> {
    return readAnywhere(toPosixPath(entry), {
        ...options,
        readText: readTextFile,
    });
}

export async function readTextFile(file: string): Promise<string | undefined> {
    try {
        return await readFile(file, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
    }
}
