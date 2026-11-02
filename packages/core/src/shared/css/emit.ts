import type { InternalConfig } from "../../types/config.js";
import type { Reported } from "../../types/diagnostics.js";
import type { CSSFileOutput } from "../../types/generate.js";
import { diagnostic } from "../diagnostics.js";
import { getCSSBlocks, toCSS } from "@sugarcube-sh/dtcg/css";
import type { Declarations, Entry } from "./declare.js";

/**
 * Writes the design tokens' CSS variables, named from the config's `prefix` or `variableName`,
 * with every reference to a token that has its own variable written as `var()`. Each permutation
 * is a block under its selector, inside its `atRule` if it has one, in its own `path` or the
 * config's. What each block in a file writes is `dtcg/css`'s `cssBlocks`, each block for its
 * `input` (a worked-out block, the contexts that set it apart), so themes stack on one element;
 * every variable referring to what a block writes is written again, unless `redeclareDependents`
 * is `false`, so a theme set on any element gives the right values. With
 * `colorFallbackStrategy: "polyfill"`, a color outside sRGB and HSL is written as its `hex`, and
 * as itself inside an `@supports` block for browsers that can show it. Hands back a warning when
 * the config still says `propagateDependents`; what reading and declaring found is in
 * `declared.diagnostics`.
 *
 * @example
 * const tokens = await read(config.resolver, readOptions(config));
 * const { files, diagnostics } = emitCSS(declare(tokens, config), config);
 */
export function emitCSS(
    declared: Declarations,
    config: InternalConfig,
): { files: CSSFileOutput; diagnostics: Reported[] } {
    const { redeclare, renamed } = redeclaring(config);
    const byFile = new Map<string, Entry[]>();
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

function redeclaring(config: InternalConfig): { redeclare: boolean; renamed: Reported[] } {
    const { redeclareDependents, propagateDependents } = config.variables;
    return {
        redeclare: redeclareDependents ?? propagateDependents ?? true,
        renamed:
            propagateDependents === undefined
                ? []
                : [
                      diagnostic("option-renamed", {
                          from: "propagateDependents",
                          to: "redeclareDependents",
                      }),
                  ],
    };
}
