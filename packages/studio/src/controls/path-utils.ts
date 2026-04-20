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

/** Wrap a token path in DTCG reference syntax: `path` → `{path}`. */
export function wrapRef(path: string): string {
    return `{${path}}`;
}

/** Unwrap a DTCG reference string: `{path}` → `path`. Returns undefined if not a reference. */
export function unwrapRef(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        return trimmed.slice(1, -1);
    }
    return undefined;
}

/** Strip trailing glob segments (`.*`) from a path: `"size.step.*"` → `"size.step"`. */
export function stripTrailingGlob(path: string): string {
    let p = path;
    while (p.endsWith(".*")) p = p.slice(0, -2);
    return p;
}

/** Return the last dot-separated segment of a path, stripping any trailing glob (`.*`). */
export function lastSegment(path: string): string {
    const p = stripTrailingGlob(path);
    const lastDot = p.lastIndexOf(".");
    return lastDot === -1 ? p : p.substring(lastDot + 1);
}
