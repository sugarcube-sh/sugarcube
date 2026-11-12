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
    return toAbsolutePath(getFilePath(toPosixPath(entryFile), file));
}

export function toAbsolutePath(path: string): string {
    return toPosixPath(resolve(toPosixPath(path)));
}

export function toPosixPath(path: string): string {
    return path.replaceAll("\\", "/");
}
