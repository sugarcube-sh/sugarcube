import type { InternalConfig } from "@sugarcube-sh/core";
import { extractFileRefs } from "@sugarcube-sh/core";
import { type FSWatcher, watch as chokidarWatch } from "chokidar";
import { debounce } from "./debounce.js";

/** Markup file extensions to watch for utility class changes */
const MARKUP_EXTENSIONS = new Set([
    ".html",
    ".htm",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".vue",
    ".svelte",
    ".astro",
    ".php",
    ".njk",
    ".liquid",
    ".pug",
    ".hbs",
    ".handlebars",
    ".twig",
    ".erb",
    ".ejs",
]);

/** Directories to ignore when watching */
const IGNORED_DIRS = new Set([
    "node_modules",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".astro",
    ".git",
    "coverage",
    ".pnpm",
    ".pnpm-store",
    ".npm",
    ".cache",
    ".turbo",
    ".vercel",
    ".svelte-kit",
    "out",
    "__snapshots__",
]);

export type WatchCallbacks = {
    onRegenerate: (changedPath: string) => Promise<void>;
    onError: (error: Error) => void;
    onReady: (tokenFileCount: number, markupDirs: string[]) => void;
};

export type WatcherHandle = {
    close: () => Promise<void>;
};

/**
 * Start watching for file changes and trigger regeneration.
 */
export async function startWatcher(
    config: InternalConfig,
    callbacks: WatchCallbacks
): Promise<WatcherHandle> {
    if (!config.resolver) {
        throw new Error("Resolver path is required for watch mode");
    }

    const { filePaths, resolverPath } = await extractFileRefs(config.resolver);

    // Token files to watch: resolver + all referenced files
    const tokenPaths = [resolverPath, ...filePaths];

    // Debounce regeneration to batch rapid changes
    const debouncedRegenerate = debounce(async (changedPath: string) => {
        try {
            await callbacks.onRegenerate(changedPath);
        } catch (error) {
            callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
    }, 100);

    // Watch token files
    const tokenWatcher = chokidarWatch(tokenPaths, {
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 50,
            pollInterval: 10,
        },
    });

    // Watch markup files in the current directory
    const markupWatcher = chokidarWatch(".", {
        ignoreInitial: true,
        ignored: (path, stats) => {
            // Ignore directories in the ignored list
            const segments = path.split("/");
            for (const segment of segments) {
                if (IGNORED_DIRS.has(segment)) {
                    return true;
                }
            }

            // For files, only watch markup extensions
            if (stats?.isFile()) {
                const ext = getExtension(path);
                return !MARKUP_EXTENSIONS.has(ext);
            }

            // Allow directories to be traversed
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

    // Wait for both watchers to be ready
    await Promise.all([
        new Promise<void>((resolve) => tokenWatcher.once("ready", resolve)),
        new Promise<void>((resolve) => markupWatcher.once("ready", resolve)),
    ]);

    callbacks.onReady(tokenPaths.length, ["."]);

    return {
        close: async () => {
            await Promise.all([tokenWatcher.close(), markupWatcher.close()]);
        },
    };
}

function getExtension(path: string): string {
    const lastDot = path.lastIndexOf(".");
    if (lastDot === -1) return "";
    return path.slice(lastDot).toLowerCase();
}
