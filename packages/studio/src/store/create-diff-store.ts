import { type StoreApi, createStore } from "zustand";
import type { Host } from "../host/types";
import { computeDiff } from "../tokens/compute-diff";
import type { PathIndexAccessor } from "../tokens/path-index";
import type { TokenDiffEntry } from "../tokens/types";
import type { TokenStoreAPI } from "./create-token-store";
import type { ScaleStateAPI } from "./scale-state";

export type DiffState = {
    entries: readonly TokenDiffEntry[];
    pendingPaths: ReadonlySet<string>;
};

export function pendingKey(path: string, context?: string): string {
    return context === undefined ? path : `${context}::${path}`;
}

export function pendingKeys(entries: readonly TokenDiffEntry[]): Set<string> {
    return new Set(
        entries.flatMap((entry) =>
            entry.contexts.length === 0
                ? [pendingKey(entry.path)]
                : entry.contexts.map((context) => pendingKey(entry.path, context)),
        ),
    );
}

export type DiffStoreAPI = StoreApi<DiffState>;

export type DiffStoreHandle = {
    store: DiffStoreAPI;
    activate: () => () => void;
};

export function createDiffStore(
    host: Host,
    tokenStore: TokenStoreAPI,
    scaleState: ScaleStateAPI,
    getPathIndex: PathIndexAccessor,
): DiffStoreHandle {
    const recompute = (): DiffState => {
        const baseline = host.baseline.getState();
        const { resolved } = tokenStore.getState();
        const { edits, bindings } = scaleState.getState();
        const entries = computeDiff(resolved, baseline, getPathIndex(), edits, bindings);
        return { entries, pendingPaths: pendingKeys(entries) };
    };

    const store = createStore<DiffState>(() => recompute());

    const activate = (): (() => void) => {
        store.setState(recompute());
        const unsubBaseline = host.baseline.subscribe(() => store.setState(recompute()));
        const unsubToken = tokenStore.subscribe((state, prev) => {
            if (state.resolved !== prev.resolved) store.setState(recompute());
        });

        return () => {
            unsubBaseline();
            unsubToken();
        };
    };

    return { store, activate };
}
