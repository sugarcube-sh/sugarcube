import type { ResolvedTokens } from "@sugarcube-sh/core";
import { type StoreApi, createStore } from "zustand";
import { PathIndex } from "../tokens/path-index";
import type { TokenReader, TokenSnapshot, TokenUpdate } from "../tokens/types";

export type TokenStoreState = {
    resolved: ResolvedTokens;
    css: string | null;
    isComputing: boolean;
    error: string | null;
    lastRunMs: number | null;

    /**
     * The permutation context the user is currently editing
     * (e.g. `"perm:0"`, `"perm:1"`). Reads and writes via {@link useToken}
     * scope to this context so edits don't bleed across modes/brands.
     *
     * Map back to the structured input via
     * `snapshot.config.variables.permutations[i]` where `i` is the
     * numeric suffix of the `perm:i` tag.
     */
    currentContext: string;
    setCurrentContext: (ctx: string) => void;

    getToken: TokenReader;
    setToken: (path: string, value: unknown, context?: string) => void;
    setTokens: (updates: TokenUpdate[]) => void;
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
    const pathIndex = new PathIndex(snapshot.resolved);
    const initialContext = pathIndex.contexts[0] ?? "default";

    const store = createStore<TokenStoreState>((set, get) => ({
        resolved: snapshot.resolved,
        css: null,
        isComputing: false,
        error: null,
        lastRunMs: null,

        currentContext: initialContext,
        setCurrentContext: (ctx) => set({ currentContext: ctx }),

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
            const ctx = get().currentContext;
            const original = pathIndex.readValue(snapshot.resolved, path, ctx);
            if (original === undefined) return;
            set((state) => ({
                resolved: pathIndex.setValue(state.resolved, path, original, ctx),
            }));
        },

        resetAll: () => {
            set({ resolved: snapshot.resolved });
        },
    }));

    return { store, pathIndex };
}
