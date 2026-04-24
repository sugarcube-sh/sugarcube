import type { VariableNameFn } from "../types/config.js";
import { formatCSSVarName } from "./format-css-var-name.js";

/** Subset of config needed to resolve a variable name — works against both user and internal configs. */
type VariablesNameConfig = {
    prefix?: string;
    variableName?: VariableNameFn;
};

/**
 * Build a reusable CSS variable-name resolver from a `variables` config.
 *
 * Bind once, call many times. Used by the pipeline (once at the start of
 * the render pass, then per token) and by consumers like Studio that
 * repeatedly build `var(--…)` strings and want names guaranteed to match
 * the pipeline's emitted CSS.
 *
 * Resolution order:
 *   1. `variableName` callback — owns everything. `prefix` is ignored.
 *   2. `prefix` — prepended to the default path → hyphen form.
 *   3. Default — dots become hyphens, case preserved.
 *
 * This is the single source of truth for CSS variable naming. Every
 * emission site (declarations, references, utility classes) goes through
 * this function.
 *
 * @example
 *   const varName = createVariableNameResolver(config.variables);
 *   varName("color.primary"); // → "ds-color-primary"
 */
export function createVariableNameResolver(
    variables: VariablesNameConfig | undefined
): (path: string) => string {
    const variableName = variables?.variableName;
    if (variableName) return variableName;

    const prefix = variables?.prefix;
    if (prefix) return (path: string) => `${prefix}-${formatCSSVarName(path)}`;

    return formatCSSVarName;
}
