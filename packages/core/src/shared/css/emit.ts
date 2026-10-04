import type { Diagnostic, Document, Permutation } from "@sugarcube-sh/dtcg";
import { cssVariable } from "@sugarcube-sh/dtcg/css";
import type { InternalConfig } from "../../types/config.js";
import type { Reported } from "../../types/diagnostics.js";
import type { CSSFileOutput } from "../../types/generate.js";
import { diagnostic } from "../diagnostics.js";
import { blocks, entries } from "./blocks.js";
import { type Declared, declarations } from "./declarations.js";
import { files } from "./text.js";
import { textZoomWarnings } from "./text-zoom.js";

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
 * can show it. Hands back every problem found, without throwing.
 *
 * @example
 * const doc = await read(config.resolver, readOptions(config));
 * const { files, diagnostics } = emitCSS(doc, config);
 */
export function emitCSS(
    doc: Document,
    config: InternalConfig,
): { files: CSSFileOutput; diagnostics: Reported[] } {
    const reported = doc.diagnostics.map(asReported);
    const { redeclare, renamed } = redeclaring(config);
    if (reported.some(({ kind }) => kind === "default-required"))
        return { files: [], diagnostics: [...reported, ...renamed] };

    const { prefix, variableName, transforms } = config.variables;
    const options = {
        variable: (path: string) => cssVariable(path, { prefix, name: variableName }),
        fluid: transforms.fluid,
        polyfill: transforms.colorFallbackStrategy === "polyfill",
    };
    const toWrite = entries(doc, config);
    const declaredIn = new Map<Permutation, Declared>();
    const declared = (permutation: Permutation) => {
        const found = declaredIn.get(permutation) ?? declarations(permutation, options);
        declaredIn.set(permutation, found);
        return found.declarations;
    };
    const written = files(blocks(toWrite, { declared, redeclare }));

    return {
        files: written,
        diagnostics: [
            ...reported,
            ...renamed,
            ...textZoomWarnings(
                toWrite.map(({ permutation }) => permutation),
                transforms.fluid,
            ),
            ...missingHex([...declaredIn.values()]),
        ],
    };
}

function asReported(found: Diagnostic): Reported {
    if (found.kind !== "no-default") return found;
    return diagnostic("default-required", { modifiers: found.detail.modifiers });
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

function missingHex(declared: Declared[]): Reported[] {
    const found = new Map<string, Reported>();
    for (const { token, colorSpace } of declared.flatMap(({ missing }) => missing)) {
        const key = `${token.path}\u0000${colorSpace}`;
        if (!found.has(key)) found.set(key, diagnostic("fallback-missing", { colorSpace }, token));
    }
    return [...found.values()];
}
