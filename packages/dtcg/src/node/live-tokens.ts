import type { DesignTokens, ReadOptions } from "../model/index.js";
import { onFileChanged } from "./file-changed.js";
import { toAbsolutePath, getAbsoluteFilePath } from "./paths.js";
import { read } from "./read.js";

/** Where design tokens are on disk, and how to read them. */
export interface TokensOnDisk {
    /** The resolver or token file to start from, such as `"tokens/tokens.resolver.json"`. */
    entryFile: string;
    /** How to read them, as for {@link read}. */
    options?: ReadOptions;
}

/** What led to a read, and how long it took. */
export interface ReadEvent {
    /**
     * The saved file that led to the read, such as `"dark.json"`.
     *
     * It's the name in `tokens.files`, not the full path on disk. There's none when
     * {@link LiveTokens.reread} led to the read.
     */
    file?: string;
    /** How long the read took, in milliseconds. */
    ms: number;
}

/**
 * Watches files, and says when one is saved, added or deleted.
 *
 * A chokidar watcher works, and so does Vite's `server.watcher`.
 */
export interface FileWatcher {
    add(paths: string | readonly string[]): unknown;
    on(event: "change" | "add" | "unlink", listener: (path: string) => void): unknown;
}

/**
 * Design tokens kept up to date with their files.
 *
 * Make one with {@link createLiveTokens}.
 */
export interface LiveTokens {
    /**
     * Gets the tokens from the latest read.
     *
     * It waits for any read in progress or waiting, and rejects if that read failed.
     *
     * @example
     * // After a save, wait for the new tokens
     * const tokens = await live.getTokens();
     */
    getTokens(): Promise<DesignTokens>;
    /**
     * Calls `listener` after each read, with the new tokens.
     *
     * It isn't called for the first read, or for a read a newer save has already outdated.
     *
     * @param listener - Gets the tokens and the {@link ReadEvent}, such as
     * `(tokens, { file }) => …`.
     * @returns A function that stops the calls.
     *
     * @example
     * // Log each saved file
     * const stop = live.onRead((tokens, { file }) => console.log(`${file} saved`));
     */
    onRead(listener: (tokens: DesignTokens, event: ReadEvent) => void): () => void;
    /**
     * Reads the files again.
     *
     * If you passed {@link createLiveTokens} a function, it's asked again where the files are. It
     * never rejects. A failed read goes to `onError`.
     *
     * @example
     * // After your config names a different entry file
     * await live.reread();
     */
    reread(): Promise<void>;
    /**
     * Reads again when the tokens' files are saved, added or deleted.
     *
     * It adds the files to `watcher` once the first read is done. So if you wait for the watcher's
     * `ready` event, await {@link LiveTokens.getTokens} first.
     *
     * @param watcher - The watcher to add the files to.
     *
     * @example
     * // Watch with chokidar
     * live.watch(chokidar.watch([], { ignoreInitial: true }));
     */
    watch(watcher: FileWatcher): void;
}

/**
 * Reads design tokens from disk, and again on each save.
 *
 * It reads straight away, and on each save once you pass a watcher to {@link LiveTokens.watch}.
 * Saves during a read lead to one more read.
 *
 * @param source - Where the tokens are, such as `{ entryFile: "tokens/tokens.resolver.json" }`.
 * Give a function to be asked again on every read.
 * @param options - `onError` gets each failed read, and anything a listener throws.
 *
 * @example
 * // Read, watch, and log each save
 * const live = createLiveTokens(
 *     { entryFile: "tokens/tokens.resolver.json" },
 *     { onError: console.error },
 * );
 * live.watch(chokidar.watch([], { ignoreInitial: true }));
 * live.onRead((tokens, { file }) => console.log(`${file} saved`));
 */
export function createLiveTokens(
    source: TokensOnDisk | (() => TokensOnDisk),
    { onError }: { onError: (error: unknown) => void },
): LiveTokens {
    const listeners = new Set<(tokens: DesignTokens, event: ReadEvent) => void>();
    let filesByAbsolutePath = new Map<string, string>();
    let watcher: FileWatcher | undefined;
    const watched = new Set<string>();
    let reading = false;
    let savedDuringRead = new Set<string>();
    let queued: Promise<DesignTokens> | undefined;
    let queuedFile: string | undefined;

    const watchNewFiles = () => {
        if (!watcher) return;
        const added = [...filesByAbsolutePath.keys()].filter((path) => !watched.has(path));
        for (const path of added) watched.add(path);
        if (added.length > 0) watcher.add(added);
    };

    const reload = async (): Promise<DesignTokens> => {
        reading = true;
        savedDuringRead = new Set();
        try {
            const { entryFile, options } = typeof source === "function" ? source() : source;
            const tokens = await read(entryFile, options);
            filesByAbsolutePath = new Map(
                tokens.files.map((file) => [getAbsoluteFilePath(entryFile, file), file]),
            );
            watchNewFiles();
            return tokens;
        } finally {
            reading = false;
            const savedFile = [...savedDuringRead].find((path) => filesByAbsolutePath.has(path));
            if (savedFile !== undefined) queueRead(filesByAbsolutePath.get(savedFile));
        }
    };

    const reloadAndNotify = async (file?: string): Promise<DesignTokens> => {
        const started = performance.now();
        const tokens = await reload();
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

    let latest = reload();
    latest.catch(onError);

    function queueRead(file?: string): Promise<DesignTokens> {
        queuedFile = file;
        if (queued) return queued;
        const start = () => {
            queued = undefined;
            return reloadAndNotify(queuedFile);
        };
        queued = latest.then(start, start);
        latest = queued;
        latest.catch(onError);
        return latest;
    }

    const handleChange = (path: string) => {
        const disk = toAbsolutePath(path);
        const file = filesByAbsolutePath.get(disk);
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
        watch(fileWatcher) {
            watcher = fileWatcher;
            onFileChanged(fileWatcher, handleChange);
            fileWatcher.on("add", handleChange);
            fileWatcher.on("unlink", handleChange);
            watchNewFiles();
        },
    };
}
