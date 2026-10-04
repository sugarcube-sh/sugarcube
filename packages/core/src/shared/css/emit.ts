import {
    type Diagnostic,
    type Document,
    type Input,
    type Permutation,
    type Source,
    type Token,
    isAlias,
    permutation as permutationFor,
    token,
} from "@sugarcube-sh/dtcg";
import { cssVariable } from "@sugarcube-sh/dtcg/css";
import type { FluidConfig, InternalConfig } from "../../types/config.js";
import type { Reported } from "../../types/diagnostics.js";
import type { CSSFileOutput } from "../../types/generate.js";
import { ErrorMessages, diagnosticDocs } from "../constants/error-messages.js";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { stacksOn } from "../pipeline/stacks-on.js";
import { textZoomWarnings } from "./text-zoom.js";
import { type ReplacementFor, type Written, renderToken } from "./values.js";

/**
 * Writes the design system's CSS variables, named from the config's `prefix` or `variableName`,
 * with every reference to a token that has its own variable written as `var()`. Each permutation
 * is a block under its selector, inside its `atRule` if it has one, in its own `path` or the
 * config's. A block writes only what differs from the earlier blocks in its file that reach every
 * element and every screen it does (a selector list holding `:root` or all of its selectors; no
 * at-rule, the same one, or a media query it stacks on), the later winning, so a block nothing
 * reaches is written in full. Hands back every problem found, without throwing.
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
    if (reported.some(({ kind }) => kind === "default-required"))
        return { files: [], diagnostics: reported };

    const { fluid } = config.variables.transforms;
    const entries = toWrite(doc, config);
    const diagnostics = [
        ...reported,
        ...textZoomWarnings(
            entries.map(({ permutation }) => permutation),
            fluid,
        ),
    ];
    const { prefix, variableName } = config.variables;
    const variable = (path: string) => cssVariable(path, { prefix, name: variableName });
    const declaredIn = new Map<Permutation, Declaration[]>();
    const declaredBy = (permutation: Permutation) => {
        const found = declaredIn.get(permutation) ?? declarations(permutation, variable, fluid);
        declaredIn.set(permutation, found);
        return found;
    };

    const byFile = new Map<string, Block[]>();
    for (const entry of entries) {
        const earlier = byFile.get(entry.path) ?? [];
        const inEffect = new Map<string, string>();
        for (const each of earlier.filter((block) => reaches(block.entry, entry))) {
            for (const { name, value } of each.declared) inEffect.set(name, value);
        }
        const declared = declaredBy(entry.permutation);
        const changed = declared.filter(({ name, value }) => inEffect.get(name) !== value);
        byFile.set(entry.path, [...earlier, { entry, declared, changed }]);
    }
    const files = [...byFile].flatMap(([path, blocks]) => {
        const written = blocks.filter(({ changed }) => changed.length > 0).map(text);
        return written.length > 0 ? [{ path, css: `${written.join("\n\n")}\n` }] : [];
    });
    return { files, diagnostics };
}

function asReported(found: Diagnostic): Reported {
    if (found.kind !== "no-default") return found;
    const { modifiers } = found.detail;
    return {
        kind: "default-required",
        severity: "error",
        message: ErrorMessages.DIAGNOSTICS["default-required"]({ modifiers }),
        docs: diagnosticDocs("default-required"),
        detail: { modifiers },
    };
}

interface Entry {
    permutation: Permutation;
    selector: string | string[];
    atRule?: string;
    path: string;
}

interface Block {
    entry: Entry;
    declared: Declaration[];
    changed: Declaration[];
}

function toWrite(doc: Document, config: InternalConfig): Entry[] {
    const listed = config.variables.permutations ?? [];
    if (listed.length === 0) {
        return doc.permutations.map((permutation) => ({
            permutation,
            selector: derivedSelector(doc, permutation.input),
            path: config.variables.path,
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

function reaches(earlier: Entry, later: Entry): boolean {
    const reach = [earlier.selector].flat();
    const target = [later.selector].flat();
    const everyElement = reach.includes(":root") || target.every((each) => reach.includes(each));
    const everyScreen =
        earlier.atRule === undefined ||
        earlier.atRule === later.atRule ||
        stacksOn(earlier.atRule, later.atRule);
    return everyElement && everyScreen;
}

function text({ entry: { selector, atRule }, changed }: Block): string {
    const lines = changed.map(({ name, value }) => `    ${name}: ${value};`);
    const rule = `${[selector].flat().join(",\n")} {\n${lines.join("\n")}\n}`;
    if (!atRule) return rule;
    const indented = rule.split("\n").map((line) => `    ${line}`);
    return `${atRule} {\n${indented.join("\n")}\n}`;
}

interface Declaration {
    name: string;
    value: string;
}

function declarations(
    permutation: Permutation,
    variable: (path: string) => string,
    fluid: FluidConfig,
): Declaration[] {
    const isPrivate = (each: Token) => privateSource(permutation.sources[each.source.index]);
    const renderedFor = new Map<Token, Written | undefined>();
    const rendered = (each: Token): Written | undefined => {
        if (!renderedFor.has(each))
            renderedFor.set(each, renderToken(each, replacementFor, { fluid }));
        return renderedFor.get(each);
    };
    const replacementFor: ReplacementFor = (ref) => {
        const target = isAlias(ref) ? token(permutation, ref.alias) : undefined;
        const written = target && rendered(target);
        if (!target || written === undefined) return undefined;
        return isPrivate(target) ? { written } : { variable: variable(target.path) };
    };
    return permutation.tokens.flatMap((each) => {
        const written = isPrivate(each) ? undefined : rendered(each);
        if (written === undefined) return [];
        const name = variable(each.path);
        if (typeof written === "string") return [{ name, value: written }];
        return Object.entries(written).map(([property, value]) => ({
            name: `${name}-${property}`,
            value,
        }));
    });
}

function privateSource(source: Source | undefined): boolean {
    const ours = source?.extensions?.[SUGARCUBE_NAMESPACE];
    return typeof ours === "object" && ours !== null && "emit" in ours && ours.emit === false;
}
