/**
 * Convert a DTCG token path to the CSS variable name that sugarcube's
 * pipeline generates for it.
 *
 * The convention is: dots become hyphens, with no `--` prefix.
 * Callers wrap with `--` or `var(--…)` as needed.
 *
 * Per DTCG 2025.10 §6.2, a `$root` token represents its group's base value,
 * so a trailing `.$root` segment is dropped — `color.accent.$root` emits
 * as `--color-accent`. The `$path` itself keeps `.$root` so alias references
 * like `{color.accent.$root}` still resolve.
 *
 * @example
 *   formatCSSVarName("color.blue.500")   // → "color-blue-500"
 *   formatCSSVarName("panel.radius")     // → "panel-radius"
 *   formatCSSVarName("color.accent.$root") // → "color-accent"
 *
 * This is the canonical implementation — the pipeline uses it when
 * emitting variable declarations, and external tools (e.g. Studio's
 * visual editor) use it to build `var(--…)` strings that match the
 * generated CSS.
 */
const ROOT_SUFFIX = ".$root";

export function formatCSSVarName(path: string): string {
    const normalized = path.endsWith(ROOT_SUFFIX) ? path.slice(0, -ROOT_SUFFIX.length) : path;
    return normalized
        .split(".")
        .map((segment) => segment.trim().replace(/\s+/g, "-"))
        .join("-");
}
