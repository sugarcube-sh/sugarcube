import type { InternalConfig } from "@sugarcube-sh/core/client";
import type { StudioDiskState } from "../tokens/types";
import type { StudioTokenSource } from "./types";

/**
 * What a host publishes about disk, off a source that has everything; null
 * while it does not. The config travels as JSON, which is also the copy the
 * shared state needs: a function on it (a custom `variableName`) is dropped,
 * and `hasNamingFunction` says when.
 */
export function diskStateFromSource(source: StudioTokenSource): StudioDiskState | null {
    const { config, trees, resolved, sources } = source;
    if (!config || !trees || !resolved || !sources) return null;

    return {
        config: JSON.parse(JSON.stringify(config)) as InternalConfig,
        trees,
        resolved,
        defaultContext: source.defaultContext,
        permutations: source.permutations,
        sources,
    };
}

/** The one config option the browser cannot be given: variables named by a function. */
export function hasNamingFunction(config: InternalConfig | null): boolean {
    return typeof config?.variables?.variableName === "function";
}
