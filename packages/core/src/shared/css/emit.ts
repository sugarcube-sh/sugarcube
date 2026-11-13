import type { InternalConfig } from "../../types/config.js";
import type { AnyDiagnostic } from "../../types/diagnostics.js";
import type { CSSFileOutput } from "../../types/generate.js";
import { createDiagnostic } from "../diagnostics.js";
import { getCSSBlocks, toCSS } from "@sugarcube-sh/dtcg/css";
import type { Declarations, DeclaredPermutation } from "./declare.js";

/**
 * Writes the CSS variables files.
 *
 * Each permutation is a block under its selector, in its own file or in `variables.path`.
 * A block after the first declares only the tokens its input changes. Unless
 * `variables.redeclareDependents` is false, it also declares the tokens that refer to them.
 *
 * @param declared - The variables from `declare`.
 * @param config - The config with its defaults.
 *
 * @example
 * emitCSS(declare(tokens, config), config).files.map(({ path }) => path)
 * // => ["src/styles/tokens.css"]
 */
export function emitCSS(
    declared: Declarations,
    config: InternalConfig,
): { files: CSSFileOutput; diagnostics: AnyDiagnostic[] } {
    const { redeclare, renamed } = getRedeclareOption(config);
    const byFile = new Map<string, DeclaredPermutation[]>();
    for (const entry of declared.entries) {
        const inFile = byFile.get(entry.path);
        if (inFile) inFile.push(entry);
        else byFile.set(entry.path, [entry]);
    }
    const files = [...byFile].flatMap(([path, entries]) => {
        const css = toCSS(
            getCSSBlocks(
                declared.tokens,
                entries.map(({ selector, atRule, input }) => ({
                    input,
                    selector,
                    ...(atRule && { atRules: [atRule] }),
                    redeclare,
                })),
                { writer: declared.writer },
            ),
        );
        return css ? [{ path, css }] : [];
    });
    return { files, diagnostics: renamed };
}

function getRedeclareOption(config: InternalConfig): {
    redeclare: boolean;
    renamed: AnyDiagnostic[];
} {
    const { redeclareDependents, propagateDependents } = config.variables;
    return {
        redeclare: redeclareDependents ?? propagateDependents ?? true,
        renamed:
            propagateDependents === undefined
                ? []
                : [
                      createDiagnostic("option-renamed", {
                          from: "propagateDependents",
                          to: "redeclareDependents",
                      }),
                  ],
    };
}
