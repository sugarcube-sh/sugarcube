import type { StudioConfig } from "@sugarcube-sh/core/client";
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { useHost } from "../host/host-provider";
import { currentPaletteFromReference } from "../tokens/palette";
import type { PathIndex } from "../tokens/path-index";
import type { TokenDiffEntry, TokenSnapshot } from "../tokens/types";
import { type DiffState, type DiffStoreAPI, pendingKey } from "./create-diff-store";
import type { TokenStoreAPI, TokenStoreState } from "./create-source-store";
import type { ScaleStateAPI, ScaleStateStore } from "./scale-state";

export type StudioContextValue = {
    store: TokenStoreAPI;
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

export function usePathIndex(): PathIndex {
    return useTokenStore((state) => state.index);
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
    const context = useTokenStore((state) => state.currentContext);
    const value = useTokenStore((state) => state.index.readValue(state.resolved, path, context)) as
        | T
        | undefined;
    const setToken = useTokenStore((state) => state.setToken);
    const setValue = useCallback(
        (next: T) => setToken(path, next, context),
        [setToken, path, context],
    );
    return [value, setValue];
}

export function useDescription(path: string): [string | undefined, (next: string) => void] {
    const context = useTokenStore((state) => state.currentContext);
    const description = useTokenStore((state) =>
        state.index.readDescription(state.resolved, path, context),
    );
    const setDescription = useTokenStore((state) => state.setDescription);
    const set = useCallback(
        (next: string) => {
            const trimmed = next.trim();
            setDescription(path, trimmed.length > 0 ? trimmed : undefined, context);
        },
        [setDescription, path, context],
    );
    return [description, set];
}

export function useCurrentContext(): string {
    return useTokenStore((state) => state.currentContext);
}

export function useSetCurrentContext(): (ctx: string) => void {
    return useTokenStore((state) => state.setCurrentContext);
}

export function useConflicts(): readonly string[] {
    return useTokenStore((state) => state.conflicts);
}

export function usePendingChanges(): readonly TokenDiffEntry[] {
    return useDiffStore((state) => state.entries);
}

export function usePendingChangesCount(): number {
    return useDiffStore((state) => state.entries.length);
}

export function useHasPendingChanges(): boolean {
    return useDiffStore((state) => state.entries.length > 0);
}

export function useHasPendingChange(path: string): boolean {
    const context = useCurrentContext();
    return useDiffStore(
        (state) =>
            state.pendingPaths.has(pendingKey(path)) ||
            state.pendingPaths.has(pendingKey(path, context)),
    );
}

export function useDiscard(): () => void {
    const discardTokens = useTokenStore((s) => s.discard);
    const resetScales = useScaleState((s) => s.resetAll);
    return useCallback(() => {
        resetScales();
        discardTokens();
    }, [discardTokens, resetScales]);
}

export function useFamilyPalette(family: string, palettes: readonly string[]): string | undefined {
    return useTokenStore((state) => {
        const pathIndex = state.index;
        const reader = (path: string, ctx?: string) =>
            pathIndex.readValue(state.resolved, path, ctx);
        return currentPaletteFromReference(
            reader,
            family,
            palettes,
            pathIndex,
            state.currentContext,
        );
    });
}
