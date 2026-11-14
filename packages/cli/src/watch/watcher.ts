import type { Stats } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { createChangeQueue, isConfigFile } from "@sugarcube-sh/core";
import type { DesignTokens } from "@sugarcube-sh/dtcg";
import { type LiveTokens, type ReadEvent, onFileChanged } from "@sugarcube-sh/dtcg/node";
import { type FSWatcher, watch as chokidarWatch } from "chokidar";
import { resolve } from "pathe";
import { ErrorMessages } from "../constants/error-messages.js";
import { IGNORED_DIR_NAMES, MARKUP_EXTENSIONS } from "../constants/markup.js";
import { MAX_MARKUP_FILES } from "../scan-markup.js";

export type WatchChange =
    | { kind: "config"; path: string }
    | { kind: "token"; tokens: DesignTokens; read: ReadEvent }
    | { kind: "markup"; path: string };

export interface WatchTargets {
    content?: readonly string[];
    markup: boolean;
}

export type WatchCallbacks = {
    onChange: (change: WatchChange) => Promise<WatchTargets>;
    onError: (error: unknown) => void;
    onWarning: (message: string) => void;
};

export type WatcherHandle = {
    close: () => Promise<void>;
};

const CHANGE_ORDER: WatchChange["kind"][] = ["config", "token", "markup"];

const GLOB_MAGIC = /[*?{}[\]!]/;

function getGlobBase(glob: string): string {
    const staticSegments: string[] = [];
    for (const segment of glob.split("/")) {
        if (GLOB_MAGIC.test(segment)) break;
        staticSegments.push(segment);
    }
    return staticSegments.join("/") || "/";
}

export function resolveMarkupWatchTargets(content: readonly string[] | undefined): string[] {
    if (!content || content.length === 0) return ["."];
    const dirs = content.filter((glob) => !glob.startsWith("!")).map(getGlobBase);
    return [...new Set(dirs)];
}

const IGNORE_INITIAL = { ignoreInitial: true };

export function isIgnoredMarkup(path: string, stats?: Stats): boolean {
    if (path.split(/[\\/]/).some((segment) => IGNORED_DIR_NAMES.has(segment))) return true;
    return stats?.isFile() === true && !MARKUP_EXTENSIONS.has(getExtension(path));
}

function waitUntilReady(watcher: FSWatcher): Promise<void> {
    return new Promise<void>((done) => watcher.once("ready", done));
}

export async function startWatcher(
    live: LiveTokens,
    root: string,
    first: WatchTargets,
    callbacks: WatchCallbacks,
): Promise<WatcherHandle> {
    let watched = first;

    const startMarkup = async (content: readonly string[] | undefined): Promise<WatcherHandle> => {
        const markup = chokidarWatch(resolveMarkupWatchTargets(content), {
            ...IGNORE_INITIAL,
            ignored: isIgnoredMarkup,
        });
        const markupReady = waitUntilReady(markup);
        const onMarkup = (path: string) => queue({ kind: "markup", path });
        const stopChecks = onFileChanged(markup, onMarkup);
        markup.on("add", onMarkup);
        markup.on("unlink", onMarkup);
        markup.on("error", callbacks.onError);
        await markupReady;
        const watchedCount = countWatchedFiles(markup.getWatched());
        if (watchedCount > MAX_MARKUP_FILES) {
            callbacks.onWarning(
                ErrorMessages.WATCH_MANY_MARKUP_FILES(watchedCount, MAX_MARKUP_FILES),
            );
        }
        return {
            close: () => {
                stopChecks();
                return markup.close();
            },
        };
    };
    const watchMarkup = ({ markup, content }: WatchTargets) =>
        markup ? startMarkup(content) : Promise.resolve(undefined);

    const updateTargets = async (next: WatchTargets) => {
        if (next.markup !== watched.markup || !isDeepStrictEqual(next.content, watched.content)) {
            await (await markup)?.close();
            markup = watchMarkup(next);
            await markup;
        }
        watched = next;
    };

    const queue = createChangeQueue<WatchChange>(CHANGE_ORDER, {
        onChange: async (change) => updateTargets(await callbacks.onChange(change)),
        onError: callbacks.onError,
    });

    const folder = resolve(root);
    const configs = chokidarWatch(folder, {
        ...IGNORE_INITIAL,
        depth: 0,
        ignored: (path) => resolve(path) !== folder && !isConfigFile(path, folder),
    });
    const configsReady = waitUntilReady(configs);
    const onConfig = (path: string) => queue({ kind: "config", path });
    const stopConfigChecks = onFileChanged(configs, onConfig);
    configs.on("add", onConfig);
    configs.on("unlink", onConfig);
    configs.on("error", callbacks.onError);

    const files = chokidarWatch([], IGNORE_INITIAL);
    files.on("error", callbacks.onError);
    live.watch(files);
    const stopReading = live.onRead((tokens, read) => queue({ kind: "token", tokens, read }));
    let markup = watchMarkup(watched);

    await Promise.all([markup, configsReady]);

    return {
        close: async () => {
            stopReading();
            stopConfigChecks();
            queue.cancel();
            await Promise.all([
                configs.close(),
                files.close(),
                markup.then((watcher) => watcher?.close()),
            ]);
        },
    };
}

function getExtension(path: string): string {
    const lastDot = path.lastIndexOf(".");
    if (lastDot === -1) return "";
    return path.slice(lastDot + 1).toLowerCase();
}

function countWatchedFiles(watched: Record<string, string[]>): number {
    let total = 0;
    for (const entries of Object.values(watched)) {
        total += entries.length;
    }
    return total;
}
