import type { StudioConfig } from "@sugarcube-sh/core/client";
import { createContext, useContext, useMemo } from "react";
import { useStore } from "zustand";
import { computeDiff } from "../tokens/compute-diff";
import { currentPaletteFromReference } from "../tokens/palette-discovery";
import type { PathIndex } from "../tokens/path-index";
import type { TokenDiffEntry, TokenSnapshot } from "../tokens/types";
import type { TokenStoreAPI, TokenStoreState } from "./create-token-store";
import type { ScaleStateAPI, ScaleStateStore } from "./scale-state";

/**
 * Single context for all Studio state. Stable references — set once
 * at init, never changes during a session.
 */
export type StudioContextValue = {
    mode: "devtools" | "embedded";
    store: TokenStoreAPI;
    pathIndex: PathIndex;
    snapshot: TokenSnapshot;
    scaleState: ScaleStateAPI;
    studioConfig: StudioConfig | undefined;
};

export const StudioContext = createContext<StudioContextValue | null>(null);

function useStudio(): StudioContextValue {
    const ctx = useContext(StudioContext);
    if (!ctx) throw new Error("Studio hooks must be used inside a StudioProvider");
    return ctx;
}

/** The current mode (devtools, embedded, embedded-iframe). */
export function useStudioMode(): StudioContextValue["mode"] {
    return useStudio().mode;
}

/** The project's studio panel config. */
export function useStudioConfig(): StudioConfig | undefined {
    return useStudio().studioConfig;
}

/** The PathIndex for token discovery and lookups. */
export function usePathIndex(): PathIndex {
    return useStudio().pathIndex;
}

/** The immutable baseline snapshot this session was initialised from. */
export function useSnapshot(): TokenSnapshot {
    return useStudio().snapshot;
}

/** Select from the token store (zustand selector for fine-grained subscriptions). */
export function useTokenStore<T>(selector: (state: TokenStoreState) => T): T {
    return useStore(useStudio().store, selector);
}

/** Select from the scale state store. */
export function useScaleState<T>(selector: (state: ScaleStateStore) => T): T {
    return useStore(useStudio().scaleState, selector);
}

/**
 * Read and write a single token by its bare path, scoped to the
 * current permutation context.
 *
 * Returns [value, setValue] like useState. Both reads and writes
 * target just the active permutation — edits do not fan out across
 * modes/brands.
 */
export function useToken<T = unknown>(path: string): [T | undefined, (value: T) => void] {
    const { pathIndex } = useStudio();
    const context = useTokenStore((state) => state.currentContext);
    const value = useTokenStore((state) => pathIndex.readValue(state.resolved, path, context)) as
        | T
        | undefined;
    const setToken = useTokenStore((state) => state.setToken);
    return [value, (next: T) => setToken(path, next, context)];
}

/** The currently-active permutation context (e.g. `"perm:0"`, `"perm:1"`). */
export function useCurrentContext(): string {
    return useTokenStore((state) => state.currentContext);
}

/** Setter for the currently-active permutation context. */
export function useSetCurrentContext(): (ctx: string) => void {
    return useTokenStore((state) => state.setCurrentContext);
}

/**
 * The current diff between edited and baseline tokens.
 * Memoised — callers get a stable array reference when the diff hasn't changed.
 */
export function usePendingChanges(): TokenDiffEntry[] {
    const { pathIndex, snapshot } = useStudio();
    const resolved = useTokenStore((state) => state.resolved);
    return useMemo(
        () => computeDiff(resolved, snapshot.resolved, pathIndex),
        [resolved, snapshot.resolved, pathIndex]
    );
}

/** Count of pending (unsaved/unsubmitted) token changes. */
export function usePendingChangesCount(): number {
    return usePendingChanges().length;
}

/** Whether a specific token path has a pending (unsaved) change. */
export function useHasPendingChange(path: string): boolean {
    return usePendingChanges().some((entry) => entry.path === path);
}

/** Derive the currently-selected palette for a token family, scoped to the active context. */
export function useFamilyPalette(family: string, palettes: readonly string[]): string | undefined {
    const { pathIndex } = useStudio();
    return useTokenStore((state) => {
        const reader = (path: string, ctx?: string) =>
            pathIndex.readValue(state.resolved, path, ctx);
        return currentPaletteFromReference(
            reader,
            family,
            palettes,
            pathIndex,
            state.currentContext
        );
    });
}
