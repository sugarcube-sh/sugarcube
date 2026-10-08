import type { InternalConfig } from "../../types/config.js";
import type { Reported } from "../../types/diagnostics.js";
import type { CSSFileOutput } from "../../types/generate.js";
import { diagnostic } from "../diagnostics.js";
import { blocks } from "./blocks.js";
import type { Declarations } from "./declare.js";
import { files } from "./text.js";

/**
 * Writes the design system's CSS variables, named from the config's `prefix` or `variableName`,
 * with every reference to a token that has its own variable written as `var()`. Each permutation
 * is a block under its selector, inside its `atRule` if it has one, in its own `path` or the
 * config's. A block writes only what differs from the earlier blocks in its file that reach every
 * element and every screen it does (a selector list holding `:root` or all of its selectors; no
 * at-rule, the same one, or a media query it stacks on), the later winning, so a block nothing
 * reaches is written in full. After what it changes, a block writes again every variable that
 * refers to something it changed, unless `redeclareDependents` is `false`, so a theme set on any
 * element gives the right values. With `colorFallbackStrategy: "polyfill"`, a color outside sRGB
 * and HSL is written as its `hex`, and as itself inside an `@supports` block for browsers that
 * can show it. Hands back a warning when the config still says `propagateDependents`; what
 * reading and declaring found is in `declared.diagnostics`.
 *
 * @example
 * const doc = await read(config.resolver, readOptions(config));
 * const { files, diagnostics } = emitCSS(declare(doc, config), config);
 */
export function emitCSS(
    declared: Declarations,
    config: InternalConfig,
): { files: CSSFileOutput; diagnostics: Reported[] } {
    const { redeclare, renamed } = redeclaring(config);
    return { files: files(blocks(declared.entries, { redeclare })), diagnostics: renamed };
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
