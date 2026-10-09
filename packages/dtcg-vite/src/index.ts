import { type DocumentSource, type LiveDocument, liveDocument } from "@sugarcube-sh/dtcg/node";
import type { Logger, Plugin } from "vite";

/**
 * The Document the plugin keeps current, for the plugins after it: a {@link LiveDocument} that
 * Vite's own watcher drives.
 */
export type DtcgApi = Omit<LiveDocument, "watch">;

/** The plugin, with its {@link DtcgApi} as `api`. */
export interface DtcgPlugin extends Plugin {
    api: DtcgApi;
}

/**
 * Reads a design system with `dtcg` and keeps it current on Vite's watcher: it watches exactly
 * the files the Document lists and reads again when one is saved, added or deleted. Give the
 * source as a function to be asked again on every read. What fails is logged through Vite.
 *
 * @example
 * // vite.config.ts
 * export default { plugins: [dtcg({ entry: "tokens/tokens.resolver.json" })] };
 */
export default function dtcg(source: DocumentSource | (() => DocumentSource)): DtcgPlugin {
    let logger: Logger | undefined;
    const early: unknown[] = [];
    const log = (error: unknown) =>
        logger?.error(`[dtcg] ${error instanceof Error ? error.message : String(error)}`);
    const live = liveDocument(source, {
        onError: (error) => (logger ? log(error) : early.push(error)),
    });

    return {
        name: "dtcg",
        api: { document: live.document, onRead: live.onRead, reread: live.reread },
        configResolved(config) {
            logger = config.logger;
            for (const error of early.splice(0)) log(error);
        },
        configureServer(server) {
            live.watch(server.watcher);
        },
    };
}

export type { DocumentSource, ReadEvent } from "@sugarcube-sh/dtcg/node";
