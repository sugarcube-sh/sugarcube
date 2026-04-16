import type { StudioConfig } from "@sugarcube-sh/core/client";
import { createContext, useContext, useMemo } from "react";
import { useStore } from "zustand";
import { computeDiff } from "../../store/compute-diff";
import { currentPaletteFromReference } from "../../store/palette-discovery";
import type { PathIndex } from "../../store/path-index";
import type { TokenDiffEntry } from "../../store/types";
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

/** Select from the token store (zustand selector for fine-grained subscriptions). */
export function useTokenStore<T>(selector: (state: TokenStoreState) => T): T {
    return useStore(useStudio().store, selector);
}

/** Select from the scale state store. */
export function useScaleState<T>(selector: (state: ScaleStateStore) => T): T {
    return useStore(useStudio().scaleState, selector);
}

/**
 * Read and write a single token by its bare path.
 * Returns [value, setValue] like useState.
 */
export function useToken<T = unknown>(path: string): [T | undefined, (value: T) => void] {
    const { pathIndex } = useStudio();
    const value = useTokenStore((state) => pathIndex.readValue(state.resolved, path)) as
        | T
        | undefined;
    const setToken = useTokenStore((state) => state.setToken);
    return [value, (next: T) => setToken(path, next)];
}

/**
 * The current diff between edited and baseline tokens.
 * Memoised — callers get a stable array reference when the diff hasn't changed.
 */
export function usePendingChanges(): TokenDiffEntry[] {
    const { pathIndex } = useStudio();
    const resolved = useTokenStore((state) => state.resolved);
    const snapshotResolved = pathIndex.getSnapshot().resolved;
    return useMemo(
        () => computeDiff(resolved, snapshotResolved, pathIndex),
        [resolved, snapshotResolved, pathIndex]
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

/** Derive the currently-selected palette for a token family. */
export function useFamilyPalette(family: string, palettes: readonly string[]): string | undefined {
    const { pathIndex } = useStudio();
    return useTokenStore((state) => {
        const reader = (path: string, ctx?: string) =>
            pathIndex.readValue(state.resolved, path, ctx);
        return currentPaletteFromReference(reader, family, palettes, pathIndex);
    });
}
