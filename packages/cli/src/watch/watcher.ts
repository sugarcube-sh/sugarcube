import type { Stats } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { createChangeQueue } from "@sugarcube-sh/core";
import type { Document } from "@sugarcube-sh/dtcg";
import { type LiveDocument, type ReadEvent, onFileChanged } from "@sugarcube-sh/dtcg/node";
import { type FSWatcher, watch as chokidarWatch } from "chokidar";
import { normalize } from "pathe";
import { IGNORED_DIR_NAMES, MARKUP_EXTENSIONS } from "../constants/markup.js";

export type Change =
    | { kind: "config"; path: string }
    | { kind: "token"; doc: Document; read: ReadEvent }
    | { kind: "markup"; path: string };

export interface Watched {
    content?: string[];
    markup: boolean;
}

export type WatchCallbacks = {
    onChange: (change: Change) => Promise<Watched>;
    onError: (error: unknown) => void;
    onWarning: (message: string) => void;
};

export type WatcherHandle = {
    close: () => Promise<void>;
};

const IN_ORDER: Change["kind"][] = ["config", "token", "markup"];

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

export function ignoredMarkup(path: string, stats?: Stats): boolean {
    if (path.split(/[\\/]/).some((segment) => IGNORED_DIR_NAMES.has(segment))) return true;
    return stats?.isFile() === true && !MARKUP_EXTENSIONS.has(getExtension(path));
}

export function isConfigFile(path: string, configFile: string | undefined): boolean {
    return configFile !== undefined && normalize(path) === configFile;
}

function ready(watcher: FSWatcher): Promise<void> {
    return new Promise<void>((resolve) => watcher.once("ready", resolve));
}

export async function startWatcher(
    live: LiveDocument,
    configFile: string | undefined,
    first: Watched,
    callbacks: WatchCallbacks,
): Promise<WatcherHandle> {
    let watched = first;

    const startMarkup = async (content: string[] | undefined): Promise<WatcherHandle> => {
        const markup = chokidarWatch(resolveMarkupWatchTargets(content), {
            ...CHANGES_ONLY,
            ignored: ignoredMarkup,
        });
        const markupReady = ready(markup);
        const onMarkup = (path: string) => queue({ kind: "markup", path });
        const stopChecks = onFileChanged(markup, onMarkup);
        markup.on("add", onMarkup);
        markup.on("unlink", onMarkup);
        markup.on("error", callbacks.onError);
        await markupReady;
        const watchedCount = countWatchedFiles(markup.getWatched());
        if (watchedCount > WATCH_TARGET_LIMIT) {
            callbacks.onWarning(
                `Watching ${watchedCount} files for markup changes (limit: ${WATCH_TARGET_LIMIT}). This can make watch mode slow — set \`content\` in your config to narrow the directories that are scanned.`,
            );
        }
        return {
            close: () => {
                stopChecks();
                return markup.close();
            },
        };
    };
    const markupFor = ({ markup, content }: Watched) =>
        markup ? startMarkup(content) : Promise.resolve(undefined);

    const update = async (next: Watched) => {
        if (next.markup !== watched.markup || !isDeepStrictEqual(next.content, watched.content)) {
            await (await markup)?.close();
            markup = markupFor(next);
            await markup;
        }
        watched = next;
    };

    const queue = createChangeQueue<Change>(IN_ORDER, {
        onChange: async (change) => update(await callbacks.onChange(change)),
        onError: callbacks.onError,
    });

    const files = chokidarWatch(configFile === undefined ? [] : [configFile], CHANGES_ONLY);
    const filesReady = ready(files);
    const onFile = (path: string) => {
        if (isConfigFile(path, configFile)) queue({ kind: "config", path });
    };
    const stopFileChecks = onFileChanged(files, onFile);
    files.on("add", onFile);
    files.on("unlink", onFile);
    files.on("error", callbacks.onError);
    live.watch(files);
    const stopReading = live.onRead((doc, read) => queue({ kind: "token", doc, read }));
    let markup = markupFor(watched);

    await Promise.all([markup, filesReady]);

    return {
        close: async () => {
            stopReading();
            stopFileChecks();
            queue.cancel();
            await Promise.all([files.close(), markup.then((watcher) => watcher?.close())]);
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
