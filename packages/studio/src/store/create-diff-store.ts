import { type StoreApi, createStore } from "zustand";
import { computeDiff } from "../tokens/compute-diff";
import type { TokenDiffEntry } from "../tokens/types";
import type { SourceStoreHandle } from "./create-source-store";
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

/**
 * The change list, against the source store's own baseline: the one the
 * files were opened from, or the one the last save left. A save moves it
 * (`adopt`) without touching `resolved`, so `ops` is watched as well.
 */
export function createDiffStore(
    tokens: Pick<SourceStoreHandle, "store" | "getBaseline">,
    scaleState: ScaleStateAPI,
): DiffStoreHandle {
    const recompute = (): DiffState => {
        const { resolved, index } = tokens.store.getState();
        const baseline = tokens.getBaseline();
        const { edits, bindings, bases, authoredBases } = scaleState.getState();
        const entries = computeDiff({
            resolved,
            baseline,
            index,
            baselineIndex: baseline.index,
            scale: { edits, bindings, bases, authoredBases },
        });
        return { entries, pendingPaths: pendingKeys(entries) };
    };

    const store = createStore<DiffState>(() => recompute());

    const activate = (): (() => void) => {
        store.setState(recompute());
        return tokens.store.subscribe((state, prev) => {
            if (state.resolved !== prev.resolved || state.ops !== prev.ops) {
                store.setState(recompute());
            }
        });
    };

    return { store, activate };
}
