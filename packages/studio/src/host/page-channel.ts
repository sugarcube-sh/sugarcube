import { assignCSSNames, generateCSSVariables, groupByContext } from "@sugarcube-sh/core/client";
import { connectPanelChannel } from "devframe/in-page-channel";
import type { StoreApi } from "zustand";
import { STUDIO_PAGE_CHANNEL, type StudioPageProtocol } from "../page/protocol";
import type { TokenStoreAPI } from "../store/create-source-store";
import type { TokenSnapshot } from "../tokens/types";

/**
 * The CSS for the page Studio is docked on, regenerated on every edit and on
 * every reconnect. Reads the baseline as it is now, never a copy of it: a disk
 * change that adds a context is in the next frame's CSS.
 */
export function attachPageChannel(
    store: TokenStoreAPI,
    baseline: StoreApi<TokenSnapshot>,
): () => void {
    const channel = connectPanelChannel<StudioPageProtocol>({
        name: STUDIO_PAGE_CHANNEL,
        allowedOrigins: ["*"],
        functions: {},
    });

    let activeRun: AbortController | null = null;

    async function run(signal: AbortSignal) {
        const { resolved } = store.getState();
        const { trees, config, permutations } = baseline.getState();
        const converted = assignCSSNames(groupByContext(trees, resolved), config);
        const output = await generateCSSVariables(converted, config, permutations);
        if (signal.aborted) return;
        channel.emit("css", output.map((file) => file.css).join("\n\n"));
    }

    function schedule() {
        activeRun?.abort();
        activeRun = new AbortController();
        const { signal } = activeRun;
        requestAnimationFrame(() => {
            if (!signal.aborted) {
                run(signal).catch((err) => console.error("[studio] page CSS failed:", err));
            }
        });
    }

    const unsubStatus = channel.events.on("status:updated", (status) => {
        if (status === "connected") schedule();
    });
    const unsubscribe = store.subscribe((state, prev) => {
        if (state.resolved !== prev.resolved) schedule();
    });

    return () => {
        activeRun?.abort();
        unsubStatus();
        unsubscribe();
        channel.close();
    };
}
