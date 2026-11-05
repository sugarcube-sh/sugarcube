import { statSync } from "node:fs";
import { stat } from "node:fs/promises";
import type { FileWatcher } from "./live-tokens.js";

/**
 * A saved file's size and modified time, from a watcher.
 *
 * Node's `Stats` has both.
 */
export interface FileStats {
    size: number;
    mtimeMs: number;
}

const WATCHER_DROPS_CHANGES_FOR_MS = 50;

/**
 * Calls `listener` each time `watcher` says a file was saved.
 *
 * chokidar can miss the end of a save. So 50 ms after each save, it checks the file again. If the
 * file is different by then, it calls `listener` again.
 *
 * @param watcher - The watcher, such as `chokidar.watch(paths)`.
 * @param listener - Gets the saved file's path.
 * @returns A function that cancels the checks still waiting.
 *
 * @example
 * // Rebuild on each save
 * const stop = onFileChanged(chokidar.watch(paths), (path) => rebuild(path));
 */
export function onFileChanged(
    watcher: Pick<FileWatcher, "on">,
    listener: (path: string) => void,
): () => void {
    const waiting = new Set<ReturnType<typeof setTimeout>>();
    let stopped = false;
    const reported = (path: string, before: FileStats | undefined) => {
        listener(path);
        const check = setTimeout(async () => {
            waiting.delete(check);
            const now = await statsOf(path);
            if (stopped) return;
            if (now && !(before && sameFile(before, now))) listener(path);
        }, WATCHER_DROPS_CHANGES_FOR_MS);
        waiting.add(check);
    };
    const changed = (path: string, seen?: FileStats) => reported(path, seen ?? statsNow(path));
    watcher.on("change", changed);
    return () => {
        stopped = true;
        for (const check of waiting) clearTimeout(check);
        waiting.clear();
    };
}

function statsNow(path: string): FileStats | undefined {
    try {
        const { size, mtimeMs } = statSync(path);
        return { size, mtimeMs };
    } catch {
        return undefined;
    }
}

function statsOf(path: string): Promise<FileStats | undefined> {
    return stat(path).then(
        ({ size, mtimeMs }) => ({ size, mtimeMs }),
        () => undefined,
    );
}

function sameFile(a: FileStats, b: FileStats): boolean {
    return a.size === b.size && a.mtimeMs === b.mtimeMs;
}
