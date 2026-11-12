import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const IGNORED_FOLDERS = new Set(["node_modules", "dist", "build", "out"]);

export async function findFiles(
    paths: string | readonly string[],
    filter: (file: string) => boolean,
): Promise<string[]> {
    const found = (await Promise.all([paths].flat().map((path) => listFiles(path, filter)))).flat();
    const byResolvedPath = new Map<string, string>();
    for (const file of found) {
        const where = resolve(file);
        if (!byResolvedPath.has(where)) byResolvedPath.set(where, file);
    }
    return [...byResolvedPath.values()].sort();
}

export function isJson(file: string): boolean {
    return file.endsWith(".json");
}

async function listFiles(path: string, filter: (file: string) => boolean): Promise<string[]> {
    if (!(await stat(path)).isDirectory()) return filter(path) ? [path] : [];
    const found: string[] = [];
    const visit = async (folder: string): Promise<void> => {
        const nested: Promise<void>[] = [];
        for (const entry of await readdir(folder, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!isIgnoredFolder(entry.name)) nested.push(visit(join(folder, entry.name)));
            } else if (filter(entry.name)) {
                found.push(join(folder, entry.name));
            }
        }
        await Promise.all(nested);
    };
    await visit(path);
    return found;
}

function isIgnoredFolder(folder: string): boolean {
    return folder.startsWith(".") || IGNORED_FOLDERS.has(folder);
}
