import type { InternalConfig, VariableNameFn } from "../types/config.js";
import { formatCSSVarName } from "./format-css-var-name.js";

/** Subset of config needed to resolve a variable name — works against both user and internal configs. */
type VariablesNameConfig = {
    prefix?: string;
    variableName?: VariableNameFn;
};

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
    return createVariableNameResolver(config.variables)(path);
}

/**
 * Build a reusable variable-name resolver from a `variables` config.
 *
 * Bind once, call many times. Useful for consumers (Studio, external tools)
 * that repeatedly build `var(--…)` strings and want names guaranteed to
 * match the pipeline's emitted CSS.
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
