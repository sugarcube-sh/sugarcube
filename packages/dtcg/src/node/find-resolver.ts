import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseJson } from "../read/json.js";
import { isResolver, isResolverName } from "../read/resolver.js";

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
     * If `"content"`, a file is also a resolver when it has a top-level `resolutionOrder`. Every
     * JSON file is opened, so give it your tokens folder, not a whole project.
     *
     * @default "name"
     * @see {@link https://www.designtokens.org/TR/2025.10/resolver/#file-extension | Resolver 3.2, File extension} and {@link https://www.designtokens.org/TR/2025.10/resolver/#resolution-order | 4.1.6, Resolution Order}
     */
    by?: "name" | "content";
}

const SKIPPED = new Set(["node_modules", "dist", "build", "out"]);

const RESOLUTION_ORDER = Buffer.from('"resolutionOrder"');

/**
 * Finds the resolver in files and folders.
 *
 * It searches each folder and every folder inside it. It skips `node_modules`, `dist`, `build`,
 * `out` and folders starting with a dot. If there are several resolvers, it gives them all.
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
    const keep = by === "name" ? isResolverName : isJson;
    const files = (await Promise.all([paths].flat().map((path) => filesAt(path, keep)))).flat();
    const resolvers = by === "name" ? files : await withContent(files);
    const once = new Map<string, string>();
    for (const file of resolvers) {
        const where = resolve(file);
        if (!once.has(where)) once.set(where, file);
    }
    const [first, ...rest] = [...once.values()].sort();
    if (first === undefined) return { kind: "none" };
    return rest.length === 0
        ? { kind: "one", path: first }
        : { kind: "several", paths: [first, ...rest] };
}

async function filesAt(path: string, keep: (file: string) => boolean): Promise<string[]> {
    if (!(await stat(path)).isDirectory()) return keep(path) ? [path] : [];
    const found: string[] = [];
    const visit = async (folder: string): Promise<void> => {
        const nested: Promise<void>[] = [];
        for (const entry of await readdir(folder, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!skipped(entry.name)) nested.push(visit(join(folder, entry.name)));
            } else if (keep(entry.name)) {
                found.push(join(folder, entry.name));
            }
        }
        await Promise.all(nested);
    };
    await visit(path);
    return found;
}

function skipped(folder: string): boolean {
    return folder.startsWith(".") || SKIPPED.has(folder);
}

function isJson(file: string): boolean {
    return file.endsWith(".json");
}

async function withContent(files: string[]): Promise<string[]> {
    const kept = await Promise.all(
        files.map(async (file) => isResolverName(file) || writesResolutionOrder(file)),
    );
    return files.filter((_, index) => kept[index]);
}

async function writesResolutionOrder(file: string): Promise<boolean> {
    const bytes = await readFile(file);
    return (
        bytes.includes(RESOLUTION_ORDER) && isResolver(file, parseJson(bytes.toString("utf8")).root)
    );
}
