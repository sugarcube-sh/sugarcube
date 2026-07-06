import type { PathIndex } from "./path-index";
import { unwrapRef } from "./paths";
import type { TokenReader, TokenUpdate } from "./types";

export function currentPaletteFromReference(
    readToken: TokenReader,
    family: string,
    palettes: readonly string[],
    pathIndex: PathIndex,
    context?: string,
): string | undefined {
    const paletteSet = new Set(palettes);
    const paths = pathIndex.under(family);

    for (const path of paths) {
        const refPath = unwrapRef(readToken(path, context));
        if (!refPath) continue;
        for (const segment of refPath.split(".")) {
            if (paletteSet.has(segment)) return segment;
        }
    }

    return undefined;
}

export function familyPaletteSwapUpdates(
    family: string,
    newPalette: string,
    palettes: readonly string[],
    readToken: TokenReader,
    pathIndex: PathIndex,
): TokenUpdate[] {
    const paletteSet = new Set(palettes);
    const familyPaths = pathIndex.under(family);
    const contexts = pathIndex.contexts;
    const updates: TokenUpdate[] = [];

    for (const path of familyPaths) {
        for (const context of contexts) {
            const refPath = unwrapRef(readToken(path, context));
            if (!refPath) continue;

            const segments = refPath.split(".");
            const segmentIndex = segments.findIndex((s) => paletteSet.has(s));
            if (segmentIndex === -1) continue;
            segments[segmentIndex] = newPalette;

            updates.push({
                path,
                value: `{${segments.join(".")}}`,
                context,
            });
        }
    }

    return updates;
}
