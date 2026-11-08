import { type DesignTokens, type ReadOptions, readFromMemory } from "../src/index.js";

export type Source = string | Record<string, unknown>;

const sourcesOf = (sources: readonly Source[]) =>
    sources.map((source) => (typeof source === "string" ? { $ref: source } : source));

export function oneFile(json: unknown, options?: ReadOptions): DesignTokens {
    return readFromMemory({ files: { "tokens.json": JSON.stringify(json) } }, options);
}

export function oneSet(...sources: Source[]): string {
    return JSON.stringify({
        version: "2025.10",
        resolutionOrder: [{ type: "set", name: "base", sources: sourcesOf(sources) }],
    });
}

export function lightDark(
    base: readonly Source[],
    dark: readonly Source[],
    moreContexts: Record<string, readonly Source[]> = {},
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
