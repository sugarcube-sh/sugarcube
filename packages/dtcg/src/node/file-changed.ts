import { stat } from "node:fs/promises";
import type { FileWatcher } from "./live-document.js";

/** What a watcher knows of a file when it says the file changed: Node's `Stats` is one. */
export interface FileStats {
    size: number;
    mtimeMs: number;
}

const WATCHER_DROPS_CHANGES_FOR_MS = 50;

/**
 * Calls `listener` with each file `watcher` says was saved, and once more for a save whose last
 * write the watcher never reported. A save that empties a file and then fills
 * it is reported at the first write; chokidar, and Vite's watcher, which is chokidar, then drop
 * every change to that file for 50 ms. So after each change, once those 50 ms are over, the file
 * is compared with what the watcher saw (its size and modified time), and a file that has moved
 * on is reported again. Compares the file with itself, never with the clock, since a file's
 * modified time can lag the clock by a few milliseconds.
 *
 * @returns A function that stops the comparisons still waiting.
 *
 * @example
 * const stop = onFileChanged(chokidar.watch(paths), (path) => rebuild(path));
 */
export function onFileChanged(
    watcher: Pick<FileWatcher, "on">,
    listener: (path: string) => void,
): () => void {
    const waiting = new Set<ReturnType<typeof setTimeout>>();
    let stopped = false;
    const changed = (path: string, seen?: FileStats) => {
        listener(path);
        const before = seen ? Promise.resolve(seen) : statsOf(path);
        const check = setTimeout(async () => {
            waiting.delete(check);
            const [then, now] = await Promise.all([before, statsOf(path)]);
            if (stopped) return;
            if (now && !(then && sameFile(then, now))) listener(path);
        }, WATCHER_DROPS_CHANGES_FOR_MS);
        waiting.add(check);
    };
    watcher.on("change", changed);
    return () => {
        stopped = true;
        for (const check of waiting) clearTimeout(check);
        waiting.clear();
    };
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
