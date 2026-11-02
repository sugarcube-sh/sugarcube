import { resolve } from "node:path";
import { getFilePath } from "../read/paths.js";

/**
 * Where a file the design tokens name is on disk, for design tokens read from `entryFile`: the
 * file name joined to the entry's folder, as `read` reads it, made absolute, with `/` between
 * folders.
 *
 * @example
 * // run in /work
 * getAbsoluteFilePath("tokens/tokens.resolver.json", "themes/dark.json") // "/work/tokens/themes/dark.json"
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
