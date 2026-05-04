/**
 * React hooks over the studio's state — the React-facing surface that
 * controls and shell components consume. Wraps the underlying zustand
 * stores (token store, scale state, recipe state) and the host's
 * reactive baseline.
 */

import { type StudioConfig, createVariableNameResolver } from "@sugarcube-sh/core/client";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useHost } from "../host/host-provider";
import { computeDiff } from "../tokens/compute-diff";
import { currentPaletteFromReference } from "../tokens/palette-discovery";
import type { PathIndex } from "../tokens/path-index";
import type { TokenDiffEntry, TokenSnapshot } from "../tokens/types";
import type { TokenStoreAPI, TokenStoreState } from "./create-token-store";
import type { RecipeStateAPI, RecipeStateStore } from "./recipe-state";
import type { ScaleStateAPI, ScaleStateStore } from "./scale-state";

/** Stable references for the session — set once at TokenStoreProvider mount. */
export type StudioContextValue = {
    store: TokenStoreAPI;
    pathIndex: PathIndex;
    scaleState: ScaleStateAPI;
    recipeState: RecipeStateAPI;
};

export const StudioContext = createContext<StudioContextValue | null>(null);

function useStudio(): StudioContextValue {
    const ctx = useContext(StudioContext);
    if (!ctx) throw new Error("Studio hooks must be used inside a StudioProvider");
    return ctx;
}

/** The project's studio panel config. Reactive: re-renders when the host pushes a new baseline. */
export function useStudioConfig(): StudioConfig | undefined {
    return useBaseline().config.studio;
}

export function useVariableName(): (path: string) => string {
    const baseline = useBaseline();
    return useMemo(() => createVariableNameResolver(baseline.config.variables), [baseline]);
}

export function usePathIndex(): PathIndex {
    return useStudio().pathIndex;
}

/**
 * The current baseline snapshot — what the world considers "saved."
 * Reactive: re-renders consumers when the host pushes a new baseline
 * (DevTools: file watcher / save / discard / external edit).
 */
export function useBaseline(): TokenSnapshot {
    const host = useHost();
    return useSyncExternalStore(host.baseline.subscribe, host.baseline.getState);
}

export function useTokenStore<T>(selector: (state: TokenStoreState) => T): T {
    return useStore(useStudio().store, selector);
}

/**
 * The underlying token-store API. Use when a caller needs `getState` /
 * `setState` directly — e.g. updating a fluid token's `$value` and
 * `$extensions` together in one write, which `setToken` (which only
 * touches `$value`) can't express.
 */
export function useTokenStoreApi(): TokenStoreAPI {
    return useStudio().store;
}

export function useScaleState<T>(selector: (state: ScaleStateStore) => T): T {
    return useStore(useStudio().scaleState, selector);
}

export function useRecipeState<T>(selector: (state: RecipeStateStore) => T): T {
    return useStore(useStudio().recipeState, selector);
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
    const setValue = useCallback(
        (next: T) => setToken(path, next, context),
        [setToken, path, context]
    );
    return [value, setValue];
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
    const { pathIndex } = useStudio();
    const baseline = useBaseline();
    const resolved = useTokenStore((state) => state.resolved);
    const recipeSlots = useRecipeState((state) => state.slots);
    return useMemo(
        () => computeDiff(resolved, baseline, pathIndex, recipeSlots),
        [resolved, baseline, pathIndex, recipeSlots]
    );
}

export function usePendingChangesCount(): number {
    return usePendingChanges().length;
}

export function useHasPendingChange(path: string): boolean {
    return usePendingChanges().some((entry) => entry.path === path);
}

/**
 * Discard every kind of pending edit — token-store overlays and recipe
 * edits — in one call. Returns when host-side discard has resolved
 * (relevant in DevTools, where the server re-reads disk before the
 * working subscription pushes new state).
 */
export function useDiscard(): () => Promise<void> {
    const discardTokens = useTokenStore((s) => s.discard);
    const discardRecipes = useRecipeState((s) => s.resetAll);
    return useCallback(async () => {
        discardRecipes();
        await discardTokens();
    }, [discardTokens, discardRecipes]);
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
