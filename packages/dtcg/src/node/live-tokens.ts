import type { DesignTokens, ReadOptions } from "../model.js";
import { type FileStats, onFileChanged } from "./file-changed.js";
import { diskPath, getAbsoluteFilePath } from "./paths.js";
import { read } from "./read.js";

/** Design tokens on disk: their resolver or token file, and the options to read them with. */
export interface TokensOnDisk {
    entryFile: string;
    options?: ReadOptions;
}

/**
 * Why a read happened and how long it took: the file whose save led to it, by the design tokens'
 * name for it, as in `DesignTokens.files`, and none for {@link LiveTokens.reread}.
 */
export interface ReadEvent {
    file?: string;
    ms: number;
}

/**
 * Something that watches files and says when one is saved, added or deleted, with its path. A
 * chokidar watcher and Vite's `server.watcher` are both one.
 */
export interface FileWatcher {
    add(paths: string | readonly string[]): unknown;
    on(
        event: "change" | "add" | "unlink",
        listener: (path: string, stats?: FileStats) => void,
    ): unknown;
}

/** Design tokens kept current with their files. Made by {@link createLiveTokens}. */
export interface LiveTokens {
    /**
     * The design tokens as last read, once any read in progress or waiting to start has finished.
     * Rejects when that read failed.
     *
     * @example
     * const tokens = await live.getTokens();
     */
    getTokens(): Promise<DesignTokens>;
    /**
     * Calls `listener` with the design tokens of each read after the first, and the
     * {@link ReadEvent} that led to it. A read is not passed on when another is already waiting to
     * start, so a listener never builds on design tokens that a save or
     * {@link LiveTokens.reread} has outdated. Returns a function that stops it.
     *
     * @example
     * const stop = live.onRead((tokens, { file }) => console.log(file, tokens.diagnostics));
     */
    onRead(listener: (tokens: DesignTokens, event: ReadEvent) => void): () => void;
    /**
     * Reads the files again, asking where they are again when that was given as a function, such
     * as after a config naming the entry has changed. Resolves once the read has finished: its
     * design tokens go to the listeners, and a failure to `onError`, as for a save.
     *
     * @example
     * await live.reread();
     */
    reread(): Promise<void>;
    /**
     * Adds the files the design tokens list to `watcher`, and each file a later read gains, and
     * reads again when one of them is saved, added or deleted. Files are never removed from it: an
     * event for a file the latest design tokens do not list is ignored. Its files are added once
     * the first read has finished, so a host waiting for its watcher to be ready awaits
     * {@link LiveTokens.getTokens} first.
     *
     * @example
     * live.watch(chokidar.watch([], { ignoreInitial: true }));
     */
    watch(watcher: FileWatcher): void;
}

/**
 * Reads design tokens from disk and keeps them current with their files, for a host that runs
 * for a while, such as a dev server, a watch command or an editor. It reads at once; once given a
 * watcher, it reads again when a file the design tokens list is saved, added or deleted. Saves
 * during a read lead to one more read, a file a read gains that was saved during it is read
 * again, and so is a save whose last write the watcher never reported ({@link onFileChanged}).
 *
 * What a listener throws, and a read that fails, go to `onError`, never into the watcher's event.
 *
 * @param onDisk Where the design tokens are. Give a function to be asked again on every read.
 *
 * @example
 * const live = createLiveTokens({ entryFile: "tokens/tokens.resolver.json" }, { onError: console.error });
 * live.watch(watcher);
 * live.onRead((tokens, { file }) => console.log(`${file} saved`, tokens.diagnostics.length));
 */
export function createLiveTokens(
    onDisk: TokensOnDisk | (() => TokensOnDisk),
    { onError }: { onError: (error: unknown) => void },
): LiveTokens {
    const listeners = new Set<(tokens: DesignTokens, event: ReadEvent) => void>();
    let names = new Map<string, string>();
    let watcher: FileWatcher | undefined;
    const watched = new Set<string>();
    let reading = false;
    let savedDuringRead = new Set<string>();
    let queued: Promise<DesignTokens> | undefined;
    let queuedFile: string | undefined;

    const watchNewFiles = () => {
        if (!watcher) return;
        const added = [...names.keys()].filter((path) => !watched.has(path));
        for (const path of added) watched.add(path);
        if (added.length > 0) watcher.add(added);
    };

    const readOnce = async (): Promise<DesignTokens> => {
        reading = true;
        savedDuringRead = new Set();
        try {
            const { entryFile, options } = typeof onDisk === "function" ? onDisk() : onDisk;
            const tokens = await read(entryFile, options);
            names = new Map(
                tokens.files.map((file) => [getAbsoluteFilePath(entryFile, file), file]),
            );
            watchNewFiles();
            return tokens;
        } finally {
            reading = false;
            const missed = [...savedDuringRead].find((path) => names.has(path));
            if (missed !== undefined) queueRead(names.get(missed));
        }
    };

    const readAndTell = async (file?: string): Promise<DesignTokens> => {
        const started = performance.now();
        const tokens = await readOnce();
        const ms = performance.now() - started;
        if (queued) return tokens;
        const event: ReadEvent = file === undefined ? { ms } : { file, ms };
        for (const listener of listeners) {
            try {
                listener(tokens, event);
            } catch (error) {
                onError(error);
            }
        }
        return tokens;
    };

    let latest = readOnce();
    latest.catch(onError);

    function queueRead(file?: string): Promise<DesignTokens> {
        queuedFile = file;
        if (queued) return queued;
        const start = () => {
            queued = undefined;
            return readAndTell(queuedFile);
        };
        queued = latest.then(start, start);
        latest = queued;
        latest.catch(onError);
        return latest;
    }

    const changed = (path: string) => {
        const disk = diskPath(path);
        const file = names.get(disk);
        if (file !== undefined) queueRead(file);
        else if (reading) savedDuringRead.add(disk);
    };

    return {
        getTokens: () => latest,
        onRead(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        reread: () =>
            queueRead().then(
                () => undefined,
                () => undefined,
            ),
        watch(given) {
            watcher = given;
            onFileChanged(given, changed);
            given.on("add", changed);
            given.on("unlink", changed);
            watchNewFiles();
        },
    };
}
