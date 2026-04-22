import type { InternalConfig } from "../types/config.js";
import { formatCSSVarName } from "./format-css-var-name.js";

/**
 * Resolve the CSS variable name for a token path, honouring the user's
 * `variables.prefix` config. Called once per token during the pipeline
 * and stored on `token.$names.css` — every emission site (declarations,
 * references, utility classes) reads that cached name.
 *
 * This function is the single source of truth for CSS variable naming.
 * Extend it here to change how names are produced; callers do not need
 * to know about the rules.
 */
export function resolveVariableName(path: string, config: InternalConfig): string {
    const base = formatCSSVarName(path);
    const { prefix } = config.variables;
    return prefix ? `${prefix}-${base}` : base;
}
