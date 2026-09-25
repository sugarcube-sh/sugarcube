import type { InternalConfig } from "@sugarcube-sh/core";
import { createCoalescedRunner, debounce, extractFileRefs } from "@sugarcube-sh/core";
import { type FSWatcher, watch as chokidarWatch } from "chokidar";
import { IGNORED_DIR_NAMES, MARKUP_EXTENSIONS } from "../constants/markup.js";
import type { ChangeKind } from "./regenerate.js";

export type WatchCallbacks = {
    onRegenerate: (kind: ChangeKind, changedPath: string) => Promise<void>;
    onError: (error: Error) => void;
    onReady: (tokenFileCount: number) => void;
    onWarning?: (message: string) => void;
};

export type WatchOptions = {
    markup?: boolean;
};

export type WatcherHandle = {
    close: () => Promise<void>;
};

export type ChangeQueue = ((kind: ChangeKind, changedPath: string) => void) & {
    cancel: () => void;
};

/**
 * File events, settled for `wait` ms, then handed to `onRegenerate` one run
 * at a time: a regeneration can take longer than the gap between events, so
 * overlapping runs (concurrent globs, reads and writes to the same output)
 * are collapsed into one. What changed is kept by kind, not only the latest
 * event, so a token change is never swallowed by a markup change after it;
 * tokens run first, since markup is generated from them.
 */
export function createChangeQueue(
    callbacks: Pick<WatchCallbacks, "onRegenerate" | "onError">,
    wait = 100,
): ChangeQueue {
    const pending = new Map<ChangeKind, string>();

    const drain = createCoalescedRunner(
        async () => {
            const token = pending.get("token");
            const markup = pending.get("markup");
            pending.clear();
            if (token !== undefined) await callbacks.onRegenerate("token", token);
            if (markup !== undefined) await callbacks.onRegenerate("markup", markup);
        },
        (error) => callbacks.onError(error instanceof Error ? error : new Error(String(error))),
    );
    const settled = debounce(() => drain(), wait);

    const queue = (kind: ChangeKind, changedPath: string) => {
        pending.set(kind, changedPath);
        settled();
    };
    queue.cancel = () => {
        settled.cancel();
        pending.clear();
    };
    return queue;
}

// Mirrors scan-markup's MAX_FILES
const WATCH_TARGET_LIMIT = 10_000;

const GLOB_MAGIC = /[*?{}[\]!]/;

function globBaseDir(glob: string): string {
    const staticSegments: string[] = [];
    for (const segment of glob.split("/")) {
        if (GLOB_MAGIC.test(segment)) break;
        staticSegments.push(segment);
    }
    return staticSegments.join("/") || "/";
}

// Derive the directories to watch for markup changes from `content` globs. (Chokidar v5 no longer expands globs)
export function resolveMarkupWatchTargets(content: string[] | undefined): string[] {
    if (!content || content.length === 0) return ["."];
    const dirs = content.filter((glob) => !glob.startsWith("!")).map(globBaseDir);
    return [...new Set(dirs)];
}

const WRITE_SETTLE = {
    ignoreInitial: true,
    awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 10,
    },
};

function watchMarkup(config: InternalConfig): FSWatcher {
    return chokidarWatch(resolveMarkupWatchTargets(config.content), {
        ...WRITE_SETTLE,
        ignored: (path, stats) => {
            const segments = path.split("/");
            for (const segment of segments) {
                if (IGNORED_DIR_NAMES.has(segment)) {
                    return true;
                }
            }

            if (stats?.isFile()) {
                const ext = getExtension(path);
                return !MARKUP_EXTENSIONS.has(ext);
            }

            return false;
        },
    });
}

function ready(watcher: FSWatcher): Promise<void> {
    return new Promise<void>((resolve) => watcher.once("ready", resolve));
}

export async function startWatcher(
    config: InternalConfig,
    callbacks: WatchCallbacks,
    options: WatchOptions = {},
): Promise<WatcherHandle> {
    if (!config.resolver) {
        throw new Error("Resolver path is required for watch mode");
    }

    const { filePaths, resolverPath } = await extractFileRefs(config.resolver);

    const tokenPaths = [resolverPath, ...filePaths];

    const debouncedRegenerate = createChangeQueue(callbacks);

    const tokenWatcher = chokidarWatch(tokenPaths, WRITE_SETTLE);
    const markupWatcher = options.markup === false ? null : watchMarkup(config);

    const handleTokenChange = (path: string) => {
        debouncedRegenerate("token", path);
    };
    const handleMarkupChange = (path: string) => {
        debouncedRegenerate("markup", path);
    };

    tokenWatcher.on("change", handleTokenChange);
    tokenWatcher.on("add", handleTokenChange);
    tokenWatcher.on("unlink", handleTokenChange);

    if (markupWatcher) {
        markupWatcher.on("change", handleMarkupChange);
        markupWatcher.on("add", handleMarkupChange);
        markupWatcher.on("unlink", handleMarkupChange);
    }

    await Promise.all([ready(tokenWatcher), markupWatcher ? ready(markupWatcher) : undefined]);

    if (markupWatcher) {
        const watchedCount = countWatchedFiles(markupWatcher.getWatched());
        if (watchedCount > WATCH_TARGET_LIMIT) {
            callbacks.onWarning?.(
                `Watching ${watchedCount} files for markup changes (limit: ${WATCH_TARGET_LIMIT}). This can make watch mode slow — set \`content\` in your config to narrow the directories that are scanned.`,
            );
        }
    }

    callbacks.onReady(tokenPaths.length);

    return {
        close: async () => {
            debouncedRegenerate.cancel();
            await Promise.all([tokenWatcher.close(), markupWatcher?.close()]);
        },
    };
}

function getExtension(path: string): string {
    const lastDot = path.lastIndexOf(".");
    if (lastDot === -1) return "";
    return path.slice(lastDot + 1).toLowerCase();
}

// chokidar's getWatched() returns dir -> basenames; sum the basenames for a
// count of watched files.
function countWatchedFiles(watched: Record<string, string[]>): number {
    let total = 0;
    for (const entries of Object.values(watched)) {
        total += entries.length;
    }
    return total;
}
