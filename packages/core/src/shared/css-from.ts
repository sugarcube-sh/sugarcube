import type { DesignTokens } from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../types/config.js";
import type { AnyDiagnostic } from "../types/diagnostics.js";
import type { CSSFileOutput } from "../types/generate.js";
import { type Declarations, declare } from "./css/declare.js";
import { emitCSS } from "./css/emit.js";
import { type UtilityRule, type ClassPrefix, createUtilityRules } from "./utilities/rules.js";
import { getUtilityTokens } from "./utilities/tokens.js";
import { locateProblems } from "./diagnostics.js";

export interface UtilityCSS {
    rules: UtilityRule[];
    prefixes: ClassPrefix[];
    safelist: string[];
    customProperties: string[];
}

interface GeneratedCSS {
    declared: Declarations;
    variables: CSSFileOutput;
    utilities?: UtilityCSS;
    diagnostics: AnyDiagnostic[];
}

/**
 * Makes the variables files and the utility rules for a config.
 *
 * It also returns the declarations both are made from, and every problem found.
 * `utilities` is `undefined` when the config makes no classes.
 *
 * @param tokens - The design tokens read with `createReadOptions`.
 * @param config - The config with its defaults.
 * @param options.variables - Whether to make the variables files. It's `true` when left out.
 * @param options.utilities - Whether to make the utility rules. It's `true` when left out.
 *
 * @example
 * generateCSS(tokens, config).utilities?.prefixes.map(({ prefix }) => prefix)
 * // => ["bg", "px", "py"]
 */
export function generateCSS(
    tokens: DesignTokens,
    config: InternalConfig,
    { variables = true, utilities = true }: { variables?: boolean; utilities?: boolean } = {},
): GeneratedCSS {
    const declared = declare(tokens, config);
    const emitted = variables ? emitCSS(declared, config) : { files: [], diagnostics: [] };
    const { classes = {} } = config.utilities;
    const utilityRules =
        utilities && Object.keys(classes).length > 0
            ? createUtilityRules(getUtilityTokens(declared), classes)
            : undefined;
    return {
        declared,
        variables: emitted.files,
        utilities: utilityRules && {
            rules: utilityRules.rules,
            prefixes: utilityRules.prefixes,
            safelist: utilityRules.safelist,
            customProperties: utilityRules.customProperties,
        },
        diagnostics: [
            ...declared.diagnostics,
            ...emitted.diagnostics,
            ...locateProblems(tokens, utilityRules?.tokenProblems ?? []),
            ...(utilityRules?.diagnostics ?? []),
        ],
    };
}
