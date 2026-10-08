import { isDeepStrictEqual } from "node:util";
import { createCoalescedRunner } from "@sugarcube-sh/core";
import { type FSWatcher, watch as chokidarWatch } from "chokidar";
import { normalize } from "pathe";
import { IGNORED_DIR_NAMES, MARKUP_EXTENSIONS } from "../constants/markup.js";

export type ChangeKind = "config" | "token" | "markup";

export interface Watched {
    tokens: string[];
    config?: string;
    content?: string[];
    markup: boolean;
}

export type WatchCallbacks = {
    onChange: (kind: ChangeKind, changedPath: string) => Promise<void>;
    onError: (error: Error) => void;
    onWarning: (message: string) => void;
};

export type WatcherHandle = {
    update: (watched: Watched) => Promise<void>;
    close: () => Promise<void>;
};

export type ChangeQueue = ((kind: ChangeKind, changedPath: string) => void) & {
    cancel: () => void;
};

const IN_ORDER: ChangeKind[] = ["config", "token", "markup"];

export function createChangeQueue(
    callbacks: Pick<WatchCallbacks, "onChange" | "onError">,
): ChangeQueue {
    const pending = new Map<ChangeKind, string>();

    const drain = createCoalescedRunner(
        async () => {
            const taken = IN_ORDER.flatMap((kind) => {
                const path = pending.get(kind);
                return path === undefined ? [] : [[kind, path] as const];
            });
            pending.clear();
            for (const [kind, path] of taken) await callbacks.onChange(kind, path);
        },
        (error) => callbacks.onError(error instanceof Error ? error : new Error(String(error))),
    );
    const queue = (kind: ChangeKind, changedPath: string) => {
        pending.set(kind, changedPath);
        drain();
    };
    queue.cancel = () => pending.clear();
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

const CHANGES_ONLY = { ignoreInitial: true };

function watchMarkup(content: string[] | undefined): FSWatcher {
    return chokidarWatch(resolveMarkupWatchTargets(content), {
        ...CHANGES_ONLY,
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

function pathsOf({ tokens, config }: Watched): string[] {
    return config === undefined ? tokens : [...tokens, config];
}

export function fileChange(path: string, { config }: Watched): ChangeKind {
    return normalize(path) === config ? "config" : "token";
}

export async function startWatcher(
    first: Watched,
    callbacks: WatchCallbacks,
): Promise<WatcherHandle> {
    let watched = first;
    const queue = createChangeQueue(callbacks);

    const files = chokidarWatch(pathsOf(watched), CHANGES_ONLY);
    const filesReady = ready(files);
    const onFile = (path: string) => queue(fileChange(path, watched), path);
    files.on("change", onFile);
    files.on("add", onFile);
    files.on("unlink", onFile);

    const startMarkup = async (content: string[] | undefined): Promise<FSWatcher> => {
        const markup = watchMarkup(content);
        const markupReady = ready(markup);
        const onMarkup = (path: string) => queue("markup", path);
        markup.on("change", onMarkup);
        markup.on("add", onMarkup);
        markup.on("unlink", onMarkup);
        await markupReady;
        const watchedCount = countWatchedFiles(markup.getWatched());
        if (watchedCount > WATCH_TARGET_LIMIT) {
            callbacks.onWarning(
                `Watching ${watchedCount} files for markup changes (limit: ${WATCH_TARGET_LIMIT}). This can make watch mode slow — set \`content\` in your config to narrow the directories that are scanned.`,
            );
        }
        return markup;
    };

    let markup = watched.markup ? await startMarkup(watched.content) : undefined;
    await filesReady;

    return {
        update: async (next) => {
            const before = new Set(pathsOf(watched));
            const after = new Set(pathsOf(next));
            files.unwatch([...before].filter((path) => !after.has(path)));
            files.add([...after].filter((path) => !before.has(path)));
            if (
                next.markup !== watched.markup ||
                !isDeepStrictEqual(next.content, watched.content)
            ) {
                await markup?.close();
                markup = next.markup ? await startMarkup(next.content) : undefined;
            }
            watched = next;
        },
        close: async () => {
            queue.cancel();
            await Promise.all([files.close(), markup?.close()]);
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
