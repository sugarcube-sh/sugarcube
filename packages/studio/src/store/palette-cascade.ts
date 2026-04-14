import { type TokenReader, parseReference } from "./palette-discovery";
import type { PathIndex } from "./path-index";
import type { TokenUpdate } from "./types";

/**
 * Build token updates to swap a family's palette to `newPalette`.
 *
 * For each token under `family`, in each permutation:
 *   1. Read the current $value
 *   2. Parse the DTCG reference
 *   3. Find the segment matching a known palette name
 *   4. Replace that segment with newPalette
 *
 * Per-mode scale mappings come for free: light references {color.neutral.50},
 * dark references {color.neutral.900}, so the swap preserves the step in
 * each context.
 */
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
            const value = readToken(path, context);
            const refPath = parseReference(value);
            if (!refPath) continue;

            const segments = refPath.split(".");
            let replaced = false;
            for (let i = 0; i < segments.length; i++) {
                const segment = segments[i];
                if (segment && paletteSet.has(segment)) {
                    segments[i] = newPalette;
                    replaced = true;
                    break;
                }
            }

            if (!replaced) continue;

            updates.push({
                path,
                value: `{${segments.join(".")}}`,
                context,
            });
        }
    }

    return updates;
}
