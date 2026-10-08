import {
    type Diagnostic,
    type Document,
    type Input,
    type Permutation,
    permutation as permutationFor,
} from "@sugarcube-sh/dtcg";
import type { InternalConfig } from "../../types/config.js";
import type { Reported } from "../../types/diagnostics.js";
import { diagnostic } from "../diagnostics.js";
import { type Declared, declarationOptions, declarations } from "./declarations.js";
import { textZoomWarnings } from "./text-zoom.js";

export interface Entry {
    permutation: Permutation;
    selector: string | string[];
    atRule?: string;
    path: string;
    declared: Declared;
}

/**
 * Each permutation the config writes, in its order, with where it goes and what it declares (one
 * `declared` for every entry of one permutation); and every problem found reading and declaring:
 * the read's own, a deprecated `colorFallbackStrategy`, fluid text that fails text zoom, a color
 * with no `hex` to fall back to, and two paths making one variable.
 */
export interface Declarations {
    entries: Entry[];
    diagnostics: Reported[];
}

/**
 * Works out every CSS variable the config writes, once per build, for both `emitCSS` and
 * `utilityTokens`. With a modifier that has no default and no permutations listed, nothing can go
 * on `:root`, so nothing is declared.
 *
 * @example
 * const declared = declare(doc, config);
 * const { files } = emitCSS(declared, config);
 * const { rules, safelist } = utilityRules(utilityTokens(declared), config.utilities.classes);
 */
export function declare(doc: Document, config: InternalConfig): Declarations {
    const reported = doc.diagnostics.map(asReported);
    const deprecated =
        config.variables.transforms.colorFallbackStrategy === "polyfill"
            ? [diagnostic("option-deprecated", { option: 'colorFallbackStrategy: "polyfill"' })]
            : [];
    if (reported.some(({ kind }) => kind === "default-required"))
        return { entries: [], diagnostics: [...reported, ...deprecated] };

    const options = declarationOptions(doc, config);
    const declaredIn = new Map<Permutation, Declared>();
    const declaredFor = (permutation: Permutation) => {
        const found = declaredIn.get(permutation) ?? declarations(permutation, options);
        declaredIn.set(permutation, found);
        return found;
    };
    const toWrite = entries(doc, config, declaredFor);
    const once = [...declaredIn.values()];

    return {
        entries: toWrite,
        diagnostics: [
            ...reported,
            ...deprecated,
            ...textZoomWarnings([...declaredIn.keys()], options.fluid, options.parseOptions),
            ...missingHex(once),
            ...sameNames(once),
        ],
    };
}

function entries(
    doc: Document,
    config: InternalConfig,
    declaredFor: (permutation: Permutation) => Declared,
): Entry[] {
    const listed = config.variables.permutations ?? [];
    if (listed.length === 0) {
        return doc.permutations.map((permutation) => ({
            permutation,
            selector: derivedSelector(doc, permutation.input),
            path: config.variables.path,
            declared: declaredFor(permutation),
        }));
    }
    return listed.flatMap(({ input, selector, atRule, path }) => {
        const permutation = permutationFor(doc, input);
        if (!permutation) return [];
        return [
            {
                permutation,
                selector,
                path: path ?? config.variables.path,
                ...(atRule && { atRule }),
                declared: declaredFor(permutation),
            },
        ];
    });
}

function derivedSelector(doc: Document, input: Input): string {
    const changed = Object.entries(input).find(
        ([name, context]) => context !== doc.modifiers[name]?.default,
    );
    return changed ? `[data-${changed[0]}="${changed[1]}"]` : ":root";
}

function asReported(found: Diagnostic): Reported {
    if (found.kind !== "no-default") return found;
    const { at } = found;
    return {
        ...diagnostic("default-required", { modifiers: found.detail.modifiers }),
        ...(at && { at }),
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

function sameNames(declared: Declared[]): Reported[] {
    const found = new Map<string, Reported>();
    for (const { declarations: lines } of declared) {
        const first = new Map<string, string>();
        for (const { name, token } of lines) {
            const earlier = first.get(name);
            if (earlier === undefined) {
                first.set(name, token.path);
                continue;
            }
            const key = `${earlier}\u0000${token.path}`;
            if (earlier === token.path || found.has(key)) continue;
            const paths: [string, string] = [earlier, token.path];
            found.set(key, diagnostic("same-variable-name", { name, paths }, token));
        }
    }
    return [...found.values()];
}
