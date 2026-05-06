import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { Host } from "../host/types";
import { PathIndex } from "../tokens/path-index";
import type { TokenReader, TokenUpdate } from "../tokens/types";

export type TokenStoreState = {
    resolved: ResolvedTokens;
    css: string | null;
    isComputing: boolean;
    error: string | null;
    lastRunMs: number | null;

    /**
     * The permutation context the user is currently editing (e.g.
     * `"perm:0"`). Reads and writes via `useToken` scope to this so
     * edits don't bleed across modes/brands. Map back to structured
     * input via `snapshot.config.variables.permutations[i]`.
     */
    currentContext: string;
    setCurrentContext: (ctx: string) => void;

    getToken: TokenReader;
    setToken: (path: string, value: unknown, context?: string) => void;
    setTokens: (updates: TokenUpdate[]) => void;
    resetToken: (path: string) => void;
    /**
     * Discard pending edits in this store and on the host. When a working
     * channel exists, defers to `host.discard()` and lets the working
     * subscription propagate the new state. Otherwise resets `resolved`
     * to the baseline locally.
     */
    discard: () => Promise<void>;
};

export type TokenStoreAPI = StoreApi<TokenStoreState>;

export type CreateTokenStoreResult = {
    store: TokenStoreAPI;
    pathIndex: PathIndex;
    /**
     * Push a full resolved map. Used by scale/recipe state to commit
     * derived overlays. Routes to the working channel (DevTools) or the
     * local store (Embedded).
     */
    writeResolved: (next: ResolvedTokens) => void;
};

/**
 * Create a token store wired to a Host. Mutations route through the
 * host's working channel when present.
 */
export function createTokenStore(host: Host): CreateTokenStoreResult {
    const baselineSnap = host.baseline.getState();
    const pathIndex = new PathIndex(baselineSnap.resolved);
    const initialContext = pathIndex.contexts[0] ?? "default";
    const initialResolved = host.working ? host.working.get() : baselineSnap.resolved;

    const writeResolved = (next: ResolvedTokens) => {
        if (host.working) {
            host.working.push(next);
        } else {
            store.setState({ resolved: next });
        }
    };

    const store = createStore<TokenStoreState>((set, get) => ({
        resolved: initialResolved,
        css: null,
        isComputing: false,
        error: null,
        lastRunMs: null,

        currentContext: initialContext,
        setCurrentContext: (ctx) => set({ currentContext: ctx }),

        getToken: (path, context) => pathIndex.readValue(get().resolved, path, context),

        setToken: (path, value, context) => {
            const next = pathIndex.setValue(get().resolved, path, value, context);
            writeResolved(next);
        },

        setTokens: (updates) => {
            let next = get().resolved;
            for (const { path, value, context } of updates) {
                next = pathIndex.setValue(next, path, value, context);
            }
            writeResolved(next);
        },

        resetToken: (path) => {
            const ctx = get().currentContext;
            const original = pathIndex.readValue(baselineSnap.resolved, path, ctx);
            if (original === undefined) return;
            const next = pathIndex.setValue(get().resolved, path, original, ctx);
            writeResolved(next);
        },

        discard: async () => {
            await host.discard();
            if (!host.working) {
                set({ resolved: baselineSnap.resolved });
            }
        },
    }));

    if (host.working) {
        host.working.subscribe((resolved) => {
            store.setState({ resolved });
        });
    }

    return { store, pathIndex, writeResolved };
}
