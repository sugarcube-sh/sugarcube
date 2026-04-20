/**
 * Convert a DTCG token path to the CSS variable name that sugarcube's
 * pipeline generates for it.
 *
 * The convention is: dots become hyphens, with no `--` prefix.
 * Callers wrap with `--` or `var(--…)` as needed.
 *
 * @example
 *   formatCSSVarName("color.blue.500")   // → "color-blue-500"
 *   formatCSSVarName("panel.radius")     // → "panel-radius"
 *
 * This is the canonical implementation — the pipeline uses it when
 * emitting variable declarations, and external tools (e.g. Studio's
 * visual editor) use it to build `var(--…)` strings that match the
 * generated CSS.
 */
export function formatCSSVarName(path: string): string {
    return path.split(".").join("-");
}
