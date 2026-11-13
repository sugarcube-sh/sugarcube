import { type LoadedConfig, getTokensOnDisk } from "@sugarcube-sh/core";
import { type FileWatcher, createLiveTokens } from "@sugarcube-sh/dtcg/node";
import type { StudioFiles } from "./files";

export async function nodeFiles(
    config: LoadedConfig["config"],
    { onError }: { onError: (error: unknown) => void },
): Promise<StudioFiles & { watch(watcher: FileWatcher): void }> {
    const live = createLiveTokens(getTokensOnDisk(config), { onError });
    let tokens = await live.getTokens();
    const listeners = new Set<() => void>();
    live.onRead((next) => {
        tokens = next;
        for (const listener of listeners) listener();
    });

    return {
        now: () => ({ config, tokens, configProblems: [] }),
        onChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        watch: (watcher) => live.watch(watcher),
    };
}
