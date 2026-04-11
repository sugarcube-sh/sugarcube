import { availableContexts, tokenPathsUnder } from "./TokenStore";
import { type TokenReader, parseReference } from "./palette-discovery";

/**
 * Generic palette-swap operation.
 *
 * Given a family path, a new palette name, and the explicit list of
 * valid palette names, builds the set of token updates needed to swap
 * which palette the family references — across every permutation.
 *
 * For each token under `family`, in each permutation:
 *   1. Read the current `$value`
 *   2. Parse the DTCG reference
 *   3. Split the reference path into segments
 *   4. Find the segment that matches a name in `palettes`
 *   5. Replace that segment with `newPalette`
 *
 * References that don't contain a known palette name (e.g. literal
 * values or references like `{color.white}`) are left untouched — no
 * update is produced for them.
 *
 * Per-mode scale mappings come for free: `color.neutral.fill.quiet`
 * references `{color.neutral.50}` in light and `{color.neutral.900}` in
 * dark, so the swap naturally preserves `50` and `900` in their
 * respective contexts. No hardcoded scale tables needed.
 */

/** A single token update ready for `useTokenStore.getState().setTokens([...])`. */
export type TokenUpdate = {
    path: string;
    value: unknown;
    context?: string;
};

/**
 * Build token updates to swap a family's palette to `newPalette`.
 *
 * @param family     - Family path from config, e.g. `"color.neutral"`.
 * @param newPalette - The palette name to swap to.
 * @param palettes   - Explicit palette list (from config).
 * @param readToken  - Store's token reader (path, context → $value).
 * @returns One update per (path, context) pair whose reference was
 *          actually rewritten.
 */
export function familyPaletteSwapUpdates(
    family: string,
    newPalette: string,
    palettes: readonly string[],
    readToken: TokenReader
): TokenUpdate[] {
    const paletteSet = new Set(palettes);
    const familyPaths = tokenPathsUnder(family);
    const updates: TokenUpdate[] = [];

    for (const path of familyPaths) {
        for (const context of availableContexts) {
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
