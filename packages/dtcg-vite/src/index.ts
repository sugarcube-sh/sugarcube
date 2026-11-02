import { type LiveTokens, type TokensOnDisk, createLiveTokens } from "@sugarcube-sh/dtcg/node";
import type { Logger, Plugin } from "vite";

/**
 * The design tokens the plugin keeps current, for the plugins after it: {@link LiveTokens} that
 * Vite's own watcher drives.
 */
export type DtcgApi = Omit<LiveTokens, "watch">;

/** The plugin, with its {@link DtcgApi} as `api`. */
export interface DtcgPlugin extends Plugin {
    api: DtcgApi;
}

/**
 * Reads design tokens with `dtcg` and keeps them current on Vite's watcher: it watches exactly
 * the files the design tokens list and reads again when one is saved, added or deleted. Give where
 * they are as a function to be asked again on every read. What fails is logged through Vite.
 *
 * @example
 * // vite.config.ts
 * export default { plugins: [dtcg({ entry: "tokens/tokens.resolver.json" })] };
 */
export default function dtcg(onDisk: TokensOnDisk | (() => TokensOnDisk)): DtcgPlugin {
    let logger: Logger | undefined;
    const early: unknown[] = [];
    const log = (error: unknown) =>
        logger?.error(`[dtcg] ${error instanceof Error ? error.message : String(error)}`);
    const live = createLiveTokens(onDisk, {
        onError: (error) => (logger ? log(error) : early.push(error)),
    });

    return {
        name: "dtcg",
        api: { getTokens: live.getTokens, onRead: live.onRead, reread: live.reread },
        configResolved(config) {
            logger = config.logger;
            for (const error of early.splice(0)) log(error);
        },
        configureServer(server) {
            live.watch(server.watcher);
        },
    };
}

export type { ReadEvent, TokensOnDisk } from "@sugarcube-sh/dtcg/node";
