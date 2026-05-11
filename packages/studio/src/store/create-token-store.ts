import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import { type StoreApi, createStore } from "zustand";
import type { Host } from "../host/types";
import { type PathIndexAccessor, createPathIndexAccessor } from "../tokens/path-index";
import type { TokenReader, TokenUpdate } from "../tokens/types";

export type TokenStoreState = {
    resolved: ResolvedTokens;
    css: string | null;
    isComputing: boolean;
    error: string | null;
    lastRunMs: number | null;

    currentContext: string;
    setCurrentContext: (ctx: string) => void;

    getToken: TokenReader;
    setToken: (path: string, value: unknown, context?: string) => void;
    setTokens: (updates: TokenUpdate[]) => void;
    resetToken: (path: string) => void;
    discard: () => Promise<void>;
};

export type TokenStoreAPI = StoreApi<TokenStoreState>;

export type TokenStoreHandle = {
    store: TokenStoreAPI;
    getPathIndex: PathIndexAccessor;
    writeResolved: (next: ResolvedTokens) => void;
    activate: () => () => void;
};

export function createTokenStore(host: Host): TokenStoreHandle {
    const baselineSnap = host.baseline.getState();
    const getPathIndex = createPathIndexAccessor(() => host.baseline.getState().resolved);
    const initialContext = getPathIndex().contexts[0] ?? "default";
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

        getToken: (path, context) => getPathIndex().readValue(get().resolved, path, context),

        setToken: (path, value, context) => {
            const next = getPathIndex().setValue(get().resolved, path, value, context);
            writeResolved(next);
        },

        setTokens: (updates) => {
            const index = getPathIndex();
            let next = get().resolved;
            for (const { path, value, context } of updates) {
                next = index.setValue(next, path, value, context);
            }
            writeResolved(next);
        },

        resetToken: (path) => {
            const index = getPathIndex();
            const ctx = get().currentContext;
            const original = index.readValue(baselineSnap.resolved, path, ctx);
            if (original === undefined) return;
            const next = index.setValue(get().resolved, path, original, ctx);
            writeResolved(next);
        },

        discard: async () => {
            await host.discard();
            if (!host.working) {
                set({ resolved: baselineSnap.resolved });
            }
        },
    }));

    const activate = (): (() => void) => {
        const unsubWorking = host.working?.subscribe((resolved) => {
            store.setState({ resolved });
        });
        return () => unsubWorking?.();
    };

    return { store, getPathIndex, writeResolved, activate };
}
