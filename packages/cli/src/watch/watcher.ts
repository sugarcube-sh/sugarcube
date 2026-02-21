import type { InternalConfig } from "@sugarcube-sh/core";
import { extractFileRefs } from "@sugarcube-sh/core";
import { watch as chokidarWatch } from "chokidar";
import { IGNORED_DIR_NAMES, MARKUP_EXTENSIONS } from "../scanning/constants.js";
import { debounce } from "./debounce.js";

export type WatchCallbacks = {
    onRegenerate: (changedPath: string) => Promise<void>;
    onError: (error: Error) => void;
    onReady: (tokenFileCount: number) => void;
};

export type WatcherHandle = {
    close: () => Promise<void>;
};

export async function startWatcher(
    config: InternalConfig,
    callbacks: WatchCallbacks
): Promise<WatcherHandle> {
    if (!config.resolver) {
        throw new Error("Resolver path is required for watch mode");
    }

    const { filePaths, resolverPath } = await extractFileRefs(config.resolver);

    const tokenPaths = [resolverPath, ...filePaths];

    const debouncedRegenerate = debounce(async (changedPath: string) => {
        try {
            await callbacks.onRegenerate(changedPath);
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

    const markupWatcher = chokidarWatch(".", {
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

    const handleChange = (path: string) => {
        debouncedRegenerate(path);
    };

    tokenWatcher.on("change", handleChange);
    tokenWatcher.on("add", handleChange);
    tokenWatcher.on("unlink", handleChange);

    markupWatcher.on("change", handleChange);
    markupWatcher.on("add", handleChange);
    markupWatcher.on("unlink", handleChange);

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
