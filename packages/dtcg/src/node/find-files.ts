import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const SKIPPED = new Set(["node_modules", "dist", "build", "out"]);

export async function findFiles(
    paths: string | readonly string[],
    keep: (file: string) => boolean,
): Promise<string[]> {
    const found = (await Promise.all([paths].flat().map((path) => filesIn(path, keep)))).flat();
    const once = new Map<string, string>();
    for (const file of found) {
        const where = resolve(file);
        if (!once.has(where)) once.set(where, file);
    }
    return [...once.values()].sort();
}

export function isJson(file: string): boolean {
    return file.endsWith(".json");
}

async function filesIn(path: string, keep: (file: string) => boolean): Promise<string[]> {
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
