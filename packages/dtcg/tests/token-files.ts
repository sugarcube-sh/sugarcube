import { type DesignTokens, type ReadOptions, readFromMemory } from "../src/index.js";

export type ResolverSource = string | Record<string, unknown>;

const sourcesOf = (sources: readonly ResolverSource[]) =>
    sources.map((source) => (typeof source === "string" ? { $ref: source } : source));

export function oneFile(json: unknown, options?: ReadOptions): DesignTokens {
    return readFromMemory({ files: { "tokens.json": JSON.stringify(json) } }, options);
}

export function oneSet(...sources: ResolverSource[]): string {
    return JSON.stringify({
        version: "2025.10",
        resolutionOrder: [{ type: "set", name: "base", sources: sourcesOf(sources) }],
    });
}

export function lightDark(
    base: readonly ResolverSource[],
    dark: readonly ResolverSource[],
    moreContexts: Record<string, readonly ResolverSource[]> = {},
): string {
    const more = Object.entries(moreContexts).map(([name, sources]) => [name, sourcesOf(sources)]);
    return JSON.stringify({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: sourcesOf(base) },
            {
                type: "modifier",
                name: "mode",
                default: "light",
                contexts: { light: [], dark: sourcesOf(dark), ...Object.fromEntries(more) },
            },
        ],
    });
}
