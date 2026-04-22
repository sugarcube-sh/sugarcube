import type { InternalConfig } from "../types/config.js";
import { formatCSSVarName } from "./format-css-var-name.js";

/**
 * Resolve the CSS variable name for a token path, honouring the user's
 * `variables.prefix` and `variables.variableName` config. Called once per
 * token during the pipeline and stored on `token.$names.css` — every
 * emission site (declarations, references, utility classes) reads that
 * cached name.
 *
 * Resolution order:
 *   1. If `variableName` is set, it owns everything — `prefix` is ignored.
 *   2. Otherwise, `prefix` is prepended to the default path → hyphen form.
 *   3. Otherwise, default: dots become hyphens, case preserved.
 *
 * This function is the single source of truth for CSS variable naming.
 */
export function resolveVariableName(path: string, config: InternalConfig): string {
    const { prefix, variableName } = config.variables;
    if (variableName) return variableName(path);
    const base = formatCSSVarName(path);
    return prefix ? `${prefix}-${base}` : base;
}
