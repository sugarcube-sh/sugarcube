import { dirname, resolve } from "node:path";
import type { Document, ReadOptions } from "@sugarcube-sh/dtcg";
import { read } from "@sugarcube-sh/dtcg/node";
import { type Plugin, normalizePath } from "vite";

/** What to read: a resolver, or a token file, and how, as for `read`. */
export interface DtcgOptions {
    entry: string;
    read?: ReadOptions;
}

/** Why and how long: the file whose save led to a read (none for a reread), and its time. */
export interface Read {
    file?: string;
    ms: number;
}

/** The Document the plugin keeps, for other plugins to use. */
export interface DtcgApi {
    /**
     * The Document as last read, once any read in progress has finished.
     *
     * @example
     * const doc = await api.document();
     */
    document(): Promise<Document>;
    /**
     * Calls `listener` with each Document read after the first, when a file it lists is saved,
     * added or deleted, and on {@link DtcgApi.reread}, with the {@link Read} that made it. Returns a
     * function that stops it.
     *
     * @example
     * const stop = api.onRead((doc, { file, ms }) => console.log(file, ms, errors(doc).length));
     */
    onRead(listener: (doc: Document, read: Read) => void): () => void;
    /**
     * Reads again, asking for the options again when they were given as a function, such as
     * after a config that names the entry has changed. Saves during a read lead to one more read.
     */
    reread(): Promise<Document>;
}

/** The plugin, with its {@link DtcgApi} as `api`. */
export interface DtcgPlugin extends Plugin {
    api: DtcgApi;
}

/**
 * Reads a design system with `dtcg`, watches exactly the files the Document lists, and reads it
 * again when one is saved, so the plugins after it always have the current Document. Give
 * options as a function to be asked for them again on every read.
 *
 * @example
 * // vite.config.ts
 * export default { plugins: [dtcg({ entry: "tokens/tokens.resolver.json" })] };
 */
export default function dtcg(options: DtcgOptions | (() => DtcgOptions)): DtcgPlugin {
    const listeners = new Set<(doc: Document, read: Read) => void>();
    let watched = new Set<string>();
    let watch: (files: string[]) => void = () => {};

    const readOnce = async (): Promise<Document> => {
        const { entry, read: readOptions } = typeof options === "function" ? options() : options;
        const doc = await read(entry, readOptions);
        const folder = dirname(resolve(entry));
        watched = new Set(doc.files.map((file) => normalizePath(resolve(folder, file))));
        watch([...watched]);
        return doc;
    };

    let latest = readOnce();
    let waiting: Promise<Document> | undefined;
    let saved: string | undefined;

    const readAgain = (file?: string): Promise<Document> => {
        saved = file;
        if (waiting) return waiting;
        const next = async () => {
            waiting = undefined;
            const file = saved;
            const started = performance.now();
            latest = readOnce();
            const doc = await latest;
            const read = { file, ms: performance.now() - started };
            for (const listener of listeners) listener(doc, read);
            return doc;
        };
        waiting = latest.then(next, next);
        return waiting;
    };

    const api: DtcgApi = {
        document: () => latest,
        onRead(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        reread: () => readAgain(),
    };

    return {
        name: "dtcg",
        api,
        configureServer(server) {
            watch = (files) => server.watcher.add(files);
            watch([...watched]);
            const changed = (path: string) => {
                if (watched.has(normalizePath(path))) void readAgain(path);
            };
            server.watcher.on("change", changed);
            server.watcher.on("add", changed);
            server.watcher.on("unlink", changed);
        },
    };
}
