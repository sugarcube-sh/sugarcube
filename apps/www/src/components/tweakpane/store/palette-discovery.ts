import { tokenPathsUnder } from "./TokenStore";

/** A token reader function — matches the store's getToken signature. */
export type TokenReader = (path: string, context?: string) => unknown;

/**
 * Parse a DTCG reference value (`{token.path}`) and return the inner
 * path. Returns `undefined` for non-reference values.
 *
 * This is the DTCG spec's standard reference format — a spec guarantee,
 * not a project-specific convention.
 */
export function parseReference(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const match = value.match(/^\{(.+)\}$/);
    return match?.[1];
}

/**
 * Derive the currently-selected palette for a family by scanning
 * the family's token references for a segment matching the known
 * palette list.
 *
 * @param readToken - Store's token reader (path → $value).
 * @param family    - Family path from config, e.g. `"color.neutral"`.
 * @param palettes  - Explicit palette list from config.
 * @param context   - Optional permutation context.
 *
 * @example
 *   // Family token `color.neutral.fill.quiet` has $value `{color.blue.50}`.
 *   // palettes = ["neutral", "blue", "red"]
 *   // → returns "blue"
 *   currentPaletteFromReference(getToken, "color.neutral", palettes)
 */
export function currentPaletteFromReference(
    readToken: TokenReader,
    family: string,
    palettes: readonly string[],
    context?: string
): string | undefined {
    const paletteSet = new Set(palettes);
    const paths = tokenPathsUnder(family);

    for (const path of paths) {
        const value = readToken(path, context);
        const refPath = parseReference(value);
        if (!refPath) continue;

        // Split the reference path into segments and find the one
        // that matches a known palette name.
        const segments = refPath.split(".");
        for (const segment of segments) {
            if (paletteSet.has(segment)) return segment;
        }
    }

    return undefined;
}
