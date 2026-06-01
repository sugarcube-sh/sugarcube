import { type StudioConfig, createVariableNameResolver } from "@sugarcube-sh/core/client";
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useHost } from "../host/host-provider";
import { currentPaletteFromReference } from "../tokens/palette";
import type { PathIndex, PathIndexAccessor } from "../tokens/path-index";
import type { TokenDiffEntry, TokenSnapshot } from "../tokens/types";
import type { DiffState, DiffStoreAPI } from "./create-diff-store";
import type { TokenStoreAPI, TokenStoreState } from "./create-token-store";
import type { ScaleStateAPI, ScaleStateStore } from "./scale-state";

export type StudioContextValue = {
    store: TokenStoreAPI;
    getPathIndex: PathIndexAccessor;
    scaleState: ScaleStateAPI;
    diffStore: DiffStoreAPI;
};

export const StudioContext = createContext<StudioContextValue | null>(null);

function useStudio(): StudioContextValue {
    const ctx = useContext(StudioContext);
    if (!ctx) throw new Error("Studio hooks must be used inside a StudioProvider");
    return ctx;
}

export function useStudioConfig(): StudioConfig | undefined {
    return useBaseline().config.studio;
}

export function useVariableName(): (path: string) => string {
    const baseline = useBaseline();
    return useMemo(() => createVariableNameResolver(baseline.config.variables), [baseline]);
}

export function usePathIndex(): PathIndex {
    const host = useHost();
    const getPathIndex = useStudio().getPathIndex;
    return useSyncExternalStore(host.baseline.subscribe, getPathIndex);
}

export function useBaseline(): TokenSnapshot {
    const host = useHost();
    return useSyncExternalStore(host.baseline.subscribe, host.baseline.getState);
}

export function useTokenStore<T>(selector: (state: TokenStoreState) => T): T {
    return useStore(useStudio().store, selector);
}

export function useTokenStoreApi(): TokenStoreAPI {
    return useStudio().store;
}

export function useScaleState<T>(selector: (state: ScaleStateStore) => T): T {
    return useStore(useStudio().scaleState, selector);
}

function useDiffStore<T>(selector: (state: DiffState) => T): T {
    return useStore(useStudio().diffStore, selector);
}

export function useToken<T = unknown>(path: string): [T | undefined, (value: T) => void] {
    const getPathIndex = useStudio().getPathIndex;
    const context = useTokenStore((state) => state.currentContext);
    const value = useTokenStore((state) =>
        getPathIndex().readValue(state.resolved, path, context)
    ) as T | undefined;
    const setToken = useTokenStore((state) => state.setToken);
    const setValue = useCallback(
        (next: T) => setToken(path, next, context),
        [setToken, path, context]
    );
    return [value, setValue];
}

export function useCurrentContext(): string {
    return useTokenStore((state) => state.currentContext);
}

export function useSetCurrentContext(): (ctx: string) => void {
    return useTokenStore((state) => state.setCurrentContext);
}

export function usePendingChanges(): readonly TokenDiffEntry[] {
    return useDiffStore((state) => state.entries);
}

export function usePendingChangesCount(): number {
    return useDiffStore((state) => state.entries.length);
}

// Boolean form of the count check. Returning the boolean *inside* the
// selector means Zustand's Object.is bail kicks in when the count
// fluctuates between non-zero values (e.g. linked containers crossing
// rounding thresholds during a slider drag) — the boolean stays `true`
// and consumers don't re-render.
export function useHasPendingChanges(): boolean {
    return useDiffStore((state) => state.entries.length > 0);
}

export function useHasPendingChange(path: string): boolean {
    return useDiffStore((state) => state.pendingPaths.has(path));
}

export function useDiscard(): () => Promise<void> {
    const discardTokens = useTokenStore((s) => s.discard);
    const resetScales = useScaleState((s) => s.resetAll);
    return useCallback(async () => {
        resetScales();
        await discardTokens();
    }, [discardTokens, resetScales]);
}

export function useFamilyPalette(family: string, palettes: readonly string[]): string | undefined {
    const getPathIndex = useStudio().getPathIndex;
    return useTokenStore((state) => {
        const pathIndex = getPathIndex();
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
