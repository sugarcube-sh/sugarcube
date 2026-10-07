import { type ReadOptions, type ReadText, read } from "@sugarcube-sh/dtcg";
import type { Project } from "./index.js";

/**
 * Opens a design system for editing. Files are fetched through `readText`, so this runs
 * anywhere; `@sugarcube-sh/dtcg-edit/node` provides a version that reads from disk.
 *
 * @example
 * const project = await open("tokens.resolver.json", {
 *   readText: (path) => fetch(path).then((r) => r.text()),
 * });
 */
export async function open(
    entry: string,
    { readText, ...options }: ReadOptions & { readText: ReadText },
): Promise<Project> {
    const files: Record<string, string> = {};
    const doc = await read(entry, {
        ...options,
        readText: async (path, file) => {
            const text = await readText(path, file);
            files[file] = text;
            return text;
        },
    });
    return { doc, files, options };
}
