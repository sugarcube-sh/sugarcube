import { readFile } from "node:fs/promises";
import { parseJson } from "../read/json/parse.js";
import { isResolver, isResolverName } from "../read/resolver/check.js";
import { findFiles, isJson } from "./find-files.js";

/**
 * What {@link findResolver} found.
 *
 * It found one resolver, several or none, with the path of each.
 */
export type FoundResolver =
    | { kind: "one"; path: string }
    | { kind: "several"; paths: string[] }
    | { kind: "none" };

/** Options for {@link findResolver}. */
export interface FindResolverOptions {
    /**
     * How to tell a file is a resolver.
     *
     * If `"name"`, a file is a resolver when its name ends `.resolver.json`. No file is opened.
     *
     * If `"content"`, a file with a top-level `resolutionOrder` is a resolver too. Every JSON file
     * is opened, so search your tokens folder, not a whole project.
     *
     * @default "name"
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#file-extension | Resolver 3.2, File extension} and {@link https://www.designtokens.org/TR/2025.10/resolver/#resolution-order | 4.1.6, Resolution Order}
     */
    by?: "name" | "content";
}

const RESOLUTION_ORDER = Buffer.from('"resolutionOrder"');

/**
 * Finds the resolver in files and folders.
 *
 * It searches each folder and every folder inside it. It skips `node_modules`, `dist`, `build`,
 * `out` and folders starting with a dot. If there are several resolvers, it returns them all.
 *
 * @param paths - The files and folders to search, such as `"tokens"`.
 * @param options - How to tell a resolver, from {@link FindResolverOptions}.
 * @throws If a path doesn't exist.
 *
 * @example
 * // One resolver in the tokens folder
 * await findResolver("tokens")
 * // => { kind: "one", path: "tokens/tokens.resolver.json" }
 */
export async function findResolver(
    paths: string | readonly string[],
    { by = "name" }: FindResolverOptions = {},
): Promise<FoundResolver> {
    const files = await findFiles(paths, by === "name" ? isResolverName : isJson);
    const [first, ...rest] = by === "name" ? files : await filterResolverFiles(files);
    if (first === undefined) return { kind: "none" };
    return rest.length === 0
        ? { kind: "one", path: first }
        : { kind: "several", paths: [first, ...rest] };
}

async function filterResolverFiles(files: string[]): Promise<string[]> {
    const matches = await Promise.all(
        files.map(async (file) => isResolverName(file) || isResolverFile(file)),
    );
    return files.filter((_, index) => matches[index]);
}

async function isResolverFile(file: string): Promise<boolean> {
    const bytes = await readFile(file);
    return (
        bytes.includes(RESOLUTION_ORDER) && isResolver(file, parseJson(bytes.toString("utf8")).root)
    );
}
