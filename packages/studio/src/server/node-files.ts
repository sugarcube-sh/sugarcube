import { type LoadedConfig, getTokensOnDisk } from "@sugarcube-sh/core";
import { type FileWatcher, createLiveTokens } from "@sugarcube-sh/dtcg/node";
import type { StudioFiles } from "./files";

export async function createNodeFiles(
    config: LoadedConfig["config"],
    { onError }: { onError: (error: unknown) => void },
): Promise<StudioFiles & { watch(watcher: FileWatcher): void }> {
    const liveTokens = createLiveTokens(getTokensOnDisk(config), { onError });
    let tokens = await liveTokens.getTokens();
    const listeners = new Set<() => void>();
    liveTokens.onRead((next) => {
        tokens = next;
        for (const listener of listeners) listener();
    });

    return {
        getSnapshot: () => ({ config, tokens, configProblems: [] }),
        onChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        watch: (watcher) => liveTokens.watch(watcher),
    };
}
