import { type StudioConfig, createVariableNameResolver } from "@sugarcube-sh/core/client";
import { createContext, useContext, useMemo } from "react";
import { useStore } from "zustand";
import { computeDiff } from "../tokens/compute-diff";
import { currentPaletteFromReference } from "../tokens/palette-discovery";
import type { PathIndex } from "../tokens/path-index";
import type { TokenDiffEntry, TokenSnapshot } from "../tokens/types";
import type { TokenStoreAPI, TokenStoreState } from "./create-token-store";
import type { ScaleStateAPI, ScaleStateStore } from "./scale-state";

/**
 * Single context for all Studio state. Stable references. Set once
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

export function useStudioMode(): StudioContextValue["mode"] {
    return useStudio().mode;
}

/** The project's studio panel config. */
export function useStudioConfig(): StudioConfig | undefined {
    return useStudio().studioConfig;
}

export function useVariableName(): (path: string) => string {
    const { snapshot } = useStudio();
    return useMemo(() => createVariableNameResolver(snapshot.config.variables), [snapshot]);
}

export function usePathIndex(): PathIndex {
    return useStudio().pathIndex;
}

/** The immutable baseline snapshot this session was initialised from. */
export function useSnapshot(): TokenSnapshot {
    return useStudio().snapshot;
}

export function useTokenStore<T>(selector: (state: TokenStoreState) => T): T {
    return useStore(useStudio().store, selector);
}

export function useScaleState<T>(selector: (state: ScaleStateStore) => T): T {
    return useStore(useStudio().scaleState, selector);
}

/**
 * Read + write a token by path, scoped to the current permutation.
 * Returns `[value, setValue]` like `useState`. Edits don't fan out
 * across permutations (which would be confusing and unwanted, most likely!).
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

export function usePendingChangesCount(): number {
    return usePendingChanges().length;
}

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
