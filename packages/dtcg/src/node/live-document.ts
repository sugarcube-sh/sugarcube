import type { Document, ReadOptions } from "../index.js";
import { stat } from "node:fs/promises";
import { diskPath, fileOnDisk, read } from "./read.js";

/** What to read, as for `read`: a resolver or a token file, and how. */
export interface DocumentSource {
    entry: string;
    options?: ReadOptions;
}

/**
 * Why a read happened and how long it took: the file whose save led to it, by the Document's
 * name for it, as in `Document.files`, and none for {@link LiveDocument.reread}.
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
    on(event: "change" | "add" | "unlink", listener: (path: string) => void): unknown;
}

/** A Document kept current with its files. Made by {@link liveDocument}. */
export interface LiveDocument {
    /**
     * The Document as last read, once any read in progress or waiting to start has finished.
     * Rejects when that read failed.
     *
     * @example
     * const doc = await live.document();
     */
    document(): Promise<Document>;
    /**
     * Calls `listener` with each Document read after the first, and the {@link ReadEvent} that
     * led to it. A read is not passed on when another is already waiting to start, so a listener
     * never builds on a Document that a save or {@link LiveDocument.reread} has outdated. Returns a
     * function that stops it.
     *
     * @example
     * const stop = live.onRead((doc, { file, ms }) => console.log(file, ms, errors(doc).length));
     */
    onRead(listener: (doc: Document, event: ReadEvent) => void): () => void;
    /**
     * Reads again, asking the source again when it was given as a function, such as after a
     * config naming the entry has changed. Resolves once the read has finished: its Document
     * goes to the listeners, and a failure to `onError`, as for a save.
     *
     * @example
     * await live.reread();
     */
    reread(): Promise<void>;
    /**
     * Adds the files the Document lists to `watcher`, and each file a later read gains, and
     * reads again when one of them is saved, added or deleted. Files are never removed from it:
     * an event for a file the latest Document does not list is ignored. Its files are added once
     * the first read has finished, so a host waiting for its watcher to be ready awaits
     * {@link LiveDocument.document} first.
     *
     * @example
     * live.watch(chokidar.watch([], { ignoreInitial: true }));
     */
    watch(watcher: FileWatcher): void;
}

/**
 * Reads a design system from disk and keeps it current with its files, for a host that runs for
 * a while, such as a dev server or a watch command. It reads at once; once given a watcher, it
 * reads again when a file the Document lists is saved, added or deleted. Saves during a read lead
 * to one more read, and a file a read gains that was saved during it is read again.
 *
 * What a listener throws, and a read that fails, go to `onError`, never into the watcher's event.
 *
 * @param source What to read. Give a function to be asked again on every read.
 *
 * @example
 * const live = liveDocument({ entry: "tokens/tokens.resolver.json" }, { onError: console.error });
 * live.watch(watcher);
 * live.onRead((doc, { file }) => console.log(`${file} saved`, errors(doc).length));
 */
export function liveDocument(
    source: DocumentSource | (() => DocumentSource),
    { onError }: { onError: (error: unknown) => void },
): LiveDocument {
    const listeners = new Set<(doc: Document, event: ReadEvent) => void>();
    let names = new Map<string, string>();
    let watcher: FileWatcher | undefined;
    const watched = new Set<string>();
    let reading = false;
    let savedDuringRead = new Set<string>();
    let queued: Promise<Document> | undefined;
    let queuedFile: string | undefined;

    const watchNewFiles = () => {
        if (!watcher) return;
        const added = [...names.keys()].filter((path) => !watched.has(path));
        for (const path of added) watched.add(path);
        if (added.length > 0) watcher.add(added);
    };

    const readOnce = async (): Promise<Document> => {
        reading = true;
        savedDuringRead = new Set();
        try {
            const { entry, options } = typeof source === "function" ? source() : source;
            const started = Date.now();
            const doc = await read(entry, options);
            names = new Map(doc.files.map((file) => [fileOnDisk(entry, file), file]));
            watchNewFiles();
            const unreadable = doc.diagnostics.flatMap((found) =>
                found.kind === "invalid-json" && found.at ? [fileOnDisk(entry, found.at.file)] : [],
            );
            for (const path of unreadable) {
                if (await savedSince(path, started)) savedDuringRead.add(path);
            }
            return doc;
        } finally {
            reading = false;
            const missed = [...savedDuringRead].find((path) => names.has(path));
            if (missed !== undefined) readAgain(names.get(missed));
        }
    };

    const readAndTell = async (file?: string): Promise<Document> => {
        const started = performance.now();
        const doc = await readOnce();
        const ms = performance.now() - started;
        if (queued) return doc;
        const event: ReadEvent = file === undefined ? { ms } : { file, ms };
        for (const listener of listeners) {
            try {
                listener(doc, event);
            } catch (error) {
                onError(error);
            }
        }
        return doc;
    };

    let latest = readOnce();
    latest.catch(onError);

    function readAgain(file?: string): Promise<Document> {
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
        if (file !== undefined) readAgain(file);
        else if (reading) savedDuringRead.add(disk);
    };

    return {
        document: () => latest,
        onRead(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        reread: () =>
            readAgain().then(
                () => undefined,
                () => undefined,
            ),
        watch(given) {
            watcher = given;
            given.on("change", changed);
            given.on("add", changed);
            given.on("unlink", changed);
            watchNewFiles();
        },
    };
}

async function savedSince(path: string, time: number): Promise<boolean> {
    return stat(path).then(
        ({ mtimeMs }) => mtimeMs >= time,
        () => false,
    );
}
