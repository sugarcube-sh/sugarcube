import type { ResolvedTokens } from "@sugarcube-sh/core";
import { type StoreApi, createStore } from "zustand";
import { PathIndex } from "../../store/path-index";
import type { TokenSnapshot } from "../../store/types";

export type TokenStoreState = {
    resolved: ResolvedTokens;
    css: string | null;
    isComputing: boolean;
    error: string | null;
    lastRunMs: number | null;

    getToken: (path: string, context?: string) => unknown;
    setToken: (path: string, value: unknown, context?: string) => void;
    setTokens: (updates: Array<{ path: string; value: unknown; context?: string }>) => void;
    resetToken: (path: string) => void;
    resetAll: () => void;
};

export type TokenStoreAPI = StoreApi<TokenStoreState>;

/**
 * Create a zustand store + PathIndex from a snapshot.
 *
 * Returns both so the provider can supply each via context.
 * Each call creates an independent store — no singletons.
 */
export function createTokenStore(snapshot: TokenSnapshot): {
    store: TokenStoreAPI;
    pathIndex: PathIndex;
} {
    const pathIndex = new PathIndex(snapshot);

    const store = createStore<TokenStoreState>((set, get) => ({
        resolved: snapshot.resolved,
        css: null,
        isComputing: false,
        error: null,
        lastRunMs: null,

        getToken: (path, context) => pathIndex.readValue(get().resolved, path, context),

        setToken: (path, value, context) => {
            set((state) => ({
                resolved: pathIndex.setValue(state.resolved, path, value, context),
            }));
        },

        setTokens: (updates) => {
            set((state) => {
                let next = state.resolved;
                for (const { path, value, context } of updates) {
                    next = pathIndex.setValue(next, path, value, context);
                }
                return { resolved: next };
            });
        },

        resetToken: (path) => {
            const original = pathIndex.readValue(snapshot.resolved, path);
            if (original === undefined) return;
            set((state) => ({
                resolved: pathIndex.setValue(state.resolved, path, original),
            }));
        },

        resetAll: () => {
            set({ resolved: snapshot.resolved });
        },
    }));

    return { store, pathIndex };
}
