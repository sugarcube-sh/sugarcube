/**
 * Join token path segments, normalizing away empty parts.
 *
 * Handles the awkward cases that arise when user config contributes
 * to a path:
 *
 *   - empty prefix (palettes at the token tree root)
 *   - segments that already contain dots (e.g. `"brand.colors"`)
 *   - stray leading/trailing dots in user input
 *
 * @example
 *   joinTokenPath("color", "blue", "500")       // → "color.blue.500"
 *   joinTokenPath("", "blue", "500")            // → "blue.500"
 *   joinTokenPath("brand.colors", "blue", "50") // → "brand.colors.blue.50"
 *   joinTokenPath("color.", "blue", "50")       // → "color.blue.50"
 */
export function joinTokenPath(...segments: string[]): string {
    return segments
        .flatMap((s) => s.split("."))
        .filter(Boolean)
        .join(".");
}
