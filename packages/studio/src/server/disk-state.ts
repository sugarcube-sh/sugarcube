import type { InternalConfig } from "@sugarcube-sh/core/client";
import type { StudioDiskState } from "../tokens/types";
import type { StudioTokenSource } from "./types";

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

export function hasNamingFunction(config: InternalConfig | null): boolean {
    return typeof config?.variables?.variableName === "function";
}
