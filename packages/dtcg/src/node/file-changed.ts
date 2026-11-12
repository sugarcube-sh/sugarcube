import { statSync } from "node:fs";
import { stat } from "node:fs/promises";
import type { FileWatcher } from "./live-tokens.js";

interface FileStats {
    size: number;
    mtimeMs: number;
}

const RECHECK_DELAY_MS = 50;

/**
 * Calls `listener` each time `watcher` says a file was saved.
 *
 * chokidar can miss the end of a save. So it looks at the file just before calling `listener`, and
 * again 50 ms later. If the file is different by then, it calls `listener` again.
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
    const handleChange = (path: string) => {
        const before = tryStatSync(path);
        listener(path);
        const check = setTimeout(async () => {
            waiting.delete(check);
            const now = await readStats(path);
            if (stopped) return;
            if (now && !(before && sameStats(before, now))) listener(path);
        }, RECHECK_DELAY_MS);
        waiting.add(check);
    };
    watcher.on("change", handleChange);
    return () => {
        stopped = true;
        for (const check of waiting) clearTimeout(check);
        waiting.clear();
    };
}

function tryStatSync(path: string): FileStats | undefined {
    try {
        const { size, mtimeMs } = statSync(path);
        return { size, mtimeMs };
    } catch {
        return undefined;
    }
}

function readStats(path: string): Promise<FileStats | undefined> {
    return stat(path).then(
        ({ size, mtimeMs }) => ({ size, mtimeMs }),
        () => undefined,
    );
}

function sameStats(a: FileStats, b: FileStats): boolean {
    return a.size === b.size && a.mtimeMs === b.mtimeMs;
}
