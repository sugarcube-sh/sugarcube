import type { Document, ReadOptions } from "./index.js";

/**
 * Looks for a resolver document (`*.resolver.json`) in a folder and below.
 *
 * @example
 * const found = await findResolver(process.cwd());
 * if (found.kind === "one") await read(found.path);
 */
export function findResolver(
    folder: string,
): Promise<{ kind: "one"; path: string } | { kind: "many"; paths: string[] } | { kind: "none" }> {
    throw new Error("not implemented yet");
}

/**
 * Reads a design system from disk. Paths in the result are relative to the entry's folder: join
 * them with it to reach a file on disk.
 *
 * @example
 * const doc = await read("tokens/tokens.resolver.json");
 */
export function read(entry: string, options?: ReadOptions): Promise<Document> {
    throw new Error("not implemented yet");
}
