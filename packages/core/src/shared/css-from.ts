import type { Document } from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../types/config.js";
import type { Reported } from "../types/diagnostics.js";
import type { CSSFileOutput } from "../types/generate.js";
import { type Declarations, declare } from "./css/declare.js";
import { emitCSS } from "./css/emit.js";
import { type UtilityRule, type UtilityStart, utilityRules } from "./utilities/rules.js";
import { utilityTokens } from "./utilities/tokens.js";

export interface UtilityCSS {
    rules: UtilityRule[];
    starts: UtilityStart[];
    safelist: string[];
}

export interface MadeCSS {
    declared: Declarations;
    variables: CSSFileOutput;
    utilities?: UtilityCSS;
    diagnostics: Reported[];
}

/**
 * The declarations both halves are made from, the variables' files, the utility rules (none when
 * the config makes no classes) and every problem found making them. Leave out either half with `variables: false` or `utilities: false`.
 */
export function cssFrom(
    doc: Document,
    config: InternalConfig,
    { variables = true, utilities = true }: { variables?: boolean; utilities?: boolean } = {},
): MadeCSS {
    const declared = declare(doc, config);
    const emitted = variables ? emitCSS(declared, config) : { files: [], diagnostics: [] };
    const { classes = {} } = config.utilities;
    const ruled =
        utilities && Object.keys(classes).length > 0
            ? utilityRules(utilityTokens(declared), classes)
            : undefined;
    return {
        declared,
        variables: emitted.files,
        utilities: ruled && { rules: ruled.rules, starts: ruled.starts, safelist: ruled.safelist },
        diagnostics: [
            ...declared.diagnostics,
            ...emitted.diagnostics,
            ...(ruled?.diagnostics ?? []),
        ],
    };
}
