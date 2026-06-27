import {
    type ResolvedTokens,
    assignCSSNames,
    generateCSSVariables,
    groupByContext,
} from "@sugarcube-sh/core/client";
import { STUDIO_MESSAGE } from "@sugarcube-sh/studio-protocol";
import type { TokenStoreAPI } from "../store/create-token-store";
import type { TokenSnapshot } from "../tokens/types";

export function attachEmbeddedPipeline(
    store: TokenStoreAPI,
    snapshot: TokenSnapshot,
    parentOrigin: string
): () => void {
    let activeRun: AbortController | null = null;

    function schedule(resolved: ResolvedTokens) {
        activeRun?.abort();
        activeRun = new AbortController();
        const { signal } = activeRun;

        requestAnimationFrame(() => {
            if (signal.aborted) return;
            run(resolved, signal);
        });
    }

    async function run(resolved: ResolvedTokens, signal: AbortSignal) {
        store.setState({ isComputing: true });
        try {
            const startedAt = performance.now();
            const converted = assignCSSNames(
                groupByContext(snapshot.trees, resolved),
                snapshot.config
            );
            // Snapshots are an in-browser memory source: permutations live on the
            // config (the same convention loadTokens uses for memory sources).
            const result = await generateCSSVariables(
                converted,
                snapshot.config,
                snapshot.config.variables.permutations ?? []
            );
            if (signal.aborted) return;
            store.setState({
                css: result.map((file) => file.css).join("\n\n"),
                lastRunMs: performance.now() - startedAt,
                error: null,
                isComputing: false,
            });
        } catch (err) {
            if (signal.aborted) return;
            store.setState({
                error: err instanceof Error ? err.message : String(err),
                css: null,
                isComputing: false,
            });
        }
    }

    schedule(store.getState().resolved);

    const unsubResolved = store.subscribe((state, prev) => {
        if (state.resolved !== prev.resolved) schedule(state.resolved);
    });

    const unsubCSS = store.subscribe((state, prev) => {
        if (state.css === prev.css || state.css === null) return;
        window.parent.postMessage(
            { type: STUDIO_MESSAGE.CSS_UPDATE, css: state.css },
            parentOrigin
        );
    });

    return () => {
        activeRun?.abort();
        unsubResolved();
        unsubCSS();
    };
}
