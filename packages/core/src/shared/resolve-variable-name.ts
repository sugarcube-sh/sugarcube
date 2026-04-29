import type { VariableNameFn } from "../types/config.js";
import { formatCSSVarName } from "./format-css-var-name.js";

/** Subset of config needed to resolve a variable name — works against both user and internal configs. */
type VariablesNameConfig = {
    prefix?: string;
    variableName?: VariableNameFn;
};

/**
 * Generates CSS variable names from token paths, e.g.
 * `color.primary` → `ds-color-primary`.
 *
 * The exact name depends on your `variables` config:
 *   1. If you provided a `variableName` callback, that wins — `prefix`
 *      is ignored. You're in full control.
 *   2. If you set `prefix`, names look like `{prefix}-{path-with-hyphens}`.
 *   3. Otherwise, it's just the path with dots swapped for hyphens.
 *
 * Notice the two-step usage in the example below: you give it the config
 * once, and the result does the per-token work. The pipeline runs this
 * for every token, and we don't want to re-check the config each time.
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
