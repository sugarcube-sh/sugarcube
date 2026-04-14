import type { StudioConfig } from "@sugarcube-sh/core/client";
import { createContext, useContext } from "react";
import { useStore } from "zustand";
import { currentPaletteFromReference } from "../../store/palette-discovery";
import type { PathIndex } from "../../store/path-index";
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

/** Derive the currently-selected palette for a token family. */
export function useFamilyPalette(family: string, palettes: readonly string[]): string | undefined {
    const { pathIndex } = useStudio();
    return useTokenStore((state) => {
        const reader = (path: string, ctx?: string) =>
            pathIndex.readValue(state.resolved, path, ctx);
        return currentPaletteFromReference(reader, family, palettes, pathIndex);
    });
}
