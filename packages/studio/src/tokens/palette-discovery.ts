import type { PathIndex } from "./path-index";
import type { TokenReader } from "./types";

export function parseReference(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const match = value.match(/^\{(.+)\}$/);
    return match?.[1];
}

/**
 * Derive the currently-selected palette for a family by scanning
 * the family's token references for a segment matching the known
 * palette list.
 */
export function currentPaletteFromReference(
    readToken: TokenReader,
    family: string,
    palettes: readonly string[],
    pathIndex: PathIndex,
    context?: string
): string | undefined {
    const paletteSet = new Set(palettes);
    const paths = pathIndex.under(family);

    for (const path of paths) {
        const value = readToken(path, context);
        const refPath = parseReference(value);
        if (!refPath) continue;

        const segments = refPath.split(".");
        for (const segment of segments) {
            if (paletteSet.has(segment)) return segment;
        }
    }

    return undefined;
}
