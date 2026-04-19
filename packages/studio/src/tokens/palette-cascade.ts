import { parseReference } from "./palette-discovery";
import type { PathIndex } from "./path-index";
import type { TokenReader, TokenUpdate } from "./types";

export function familyPaletteSwapUpdates(
    family: string,
    newPalette: string,
    palettes: readonly string[],
    readToken: TokenReader,
    pathIndex: PathIndex
): TokenUpdate[] {
    const paletteSet = new Set(palettes);
    const familyPaths = pathIndex.under(family);
    const contexts = pathIndex.contexts;
    const updates: TokenUpdate[] = [];

    for (const path of familyPaths) {
        for (const context of contexts) {
            // Reading per-context means light's {neutral.50} becomes
            // {blue.50} and dark's {neutral.900} becomes {blue.900}
            // automatically — no per-mode mapping logic needed here.
            const value = readToken(path, context);
            const refPath = parseReference(value);
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
