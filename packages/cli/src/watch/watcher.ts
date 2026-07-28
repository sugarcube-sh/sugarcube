import type { InternalConfig } from "@sugarcube-sh/core";
import { extractFileRefs } from "@sugarcube-sh/core";
import { watch as chokidarWatch } from "chokidar";
import { IGNORED_DIR_NAMES, MARKUP_EXTENSIONS } from "../constants/markup.js";
import { debounce } from "./debounce.js";
import type { ChangeKind } from "./regenerate.js";

export type WatchCallbacks = {
    onRegenerate: (kind: ChangeKind, changedPath: string) => Promise<void>;
    onError: (error: Error) => void;
    onReady: (tokenFileCount: number) => void;
};

export type WatcherHandle = {
    close: () => Promise<void>;
};

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

    const debouncedRegenerate = debounce(async (kind: ChangeKind, changedPath: string) => {
        try {
            await callbacks.onRegenerate(kind, changedPath);
        } catch (error) {
            callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
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
