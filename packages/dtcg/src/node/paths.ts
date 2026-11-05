import { resolve } from "node:path";
import { getFilePath } from "../read/paths.js";

/**
 * Works out where a file the tokens name is on disk.
 *
 * It's {@link getFilePath}, made absolute, with `/` between folders even on Windows.
 *
 * @param entryFile - The file the tokens were read from, such as `"tokens/tokens.resolver.json"`.
 * @param file - A file as the tokens name it, such as `"dark.json"`.
 *
 * @example
 * // Run in /work
 * getAbsoluteFilePath("tokens/tokens.resolver.json", "dark.json")
 * // => "/work/tokens/dark.json"
 */
export function getAbsoluteFilePath(entryFile: string, file: string): string {
    return diskPath(getFilePath(slashed(entryFile), file));
}

export function diskPath(path: string): string {
    return slashed(resolve(slashed(path)));
}

export function slashed(path: string): string {
    return path.replaceAll("\\", "/");
}
