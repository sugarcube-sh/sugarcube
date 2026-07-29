import type { InternalConfig } from "@sugarcube-sh/core";
import { extractFileRefs } from "@sugarcube-sh/core";
import { watch as chokidarWatch } from "chokidar";
import { IGNORED_DIR_NAMES, MARKUP_EXTENSIONS } from "../constants/markup.js";
import { createCoalescedRunner } from "./coalesce.js";
import { debounce } from "./debounce.js";
import type { ChangeKind } from "./regenerate.js";

export type WatchCallbacks = {
    onRegenerate: (kind: ChangeKind, changedPath: string) => Promise<void>;
    onError: (error: Error) => void;
    onReady: (tokenFileCount: number) => void;
    onWarning?: (message: string) => void;
};

export type WatcherHandle = {
    close: () => Promise<void>;
};

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

export async function startWatcher(
    config: InternalConfig,
    callbacks: WatchCallbacks,
): Promise<WatcherHandle> {
    if (!config.resolver) {
        throw new Error("Resolver path is required for watch mode");
    }

    const { filePaths, resolverPath } = await extractFileRefs(config.resolver);

    const tokenPaths = [resolverPath, ...filePaths];

    // In-flight coalescing: a regeneration can take longer than the gap between
    // events, so overlapping runs (concurrent globs/reads/writes to the same
    // output) are collapsed into a single run.
    const coalescedRegenerate = createCoalescedRunner(
        (kind: ChangeKind, changedPath: string) => callbacks.onRegenerate(kind, changedPath),
        (error) => callbacks.onError(error instanceof Error ? error : new Error(String(error))),
    );

    const debouncedRegenerate = debounce((kind: ChangeKind, changedPath: string) => {
        coalescedRegenerate(kind, changedPath);
    }, 100);

    const tokenWatcher = chokidarWatch(tokenPaths, {
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 50,
            pollInterval: 10,
        },
    });

    const markupWatcher = chokidarWatch(resolveMarkupWatchTargets(config.content), {
        ignoreInitial: true,
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
        awaitWriteFinish: {
            stabilityThreshold: 50,
            pollInterval: 10,
        },
    });

    const handleTokenChange = (path: string) => {
        debouncedRegenerate("token", path);
    };
    const handleMarkupChange = (path: string) => {
        debouncedRegenerate("markup", path);
    };

    tokenWatcher.on("change", handleTokenChange);
    tokenWatcher.on("add", handleTokenChange);
    tokenWatcher.on("unlink", handleTokenChange);

    markupWatcher.on("change", handleMarkupChange);
    markupWatcher.on("add", handleMarkupChange);
    markupWatcher.on("unlink", handleMarkupChange);

    await Promise.all([
        new Promise<void>((resolve) => tokenWatcher.once("ready", resolve)),
        new Promise<void>((resolve) => markupWatcher.once("ready", resolve)),
    ]);

    const watchedCount = countWatchedFiles(markupWatcher.getWatched());
    if (watchedCount > WATCH_TARGET_LIMIT) {
        callbacks.onWarning?.(
            `Watching ${watchedCount} files for markup changes (limit: ${WATCH_TARGET_LIMIT}). This can make watch mode slow — set \`content\` in your config to narrow the directories that are scanned.`,
        );
    }

    callbacks.onReady(tokenPaths.length);

    return {
        close: async () => {
            debouncedRegenerate.cancel();
            await Promise.all([tokenWatcher.close(), markupWatcher.close()]);
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
