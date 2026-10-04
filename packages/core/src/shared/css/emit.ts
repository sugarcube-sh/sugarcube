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
import { textZoomWarnings } from "./text-zoom.js";
import { type ReplacementFor, type Written, renderToken } from "./values.js";

/**
 * Writes the design system's CSS variables to the config's `path`, named from its `prefix` or
 * `variableName`, with every reference to a token that has its own variable written as `var()`.
 * The first permutation writes every variable. Each later one, under its own selector, writes only
 * those whose value differs when the first block applies wherever it does (`:root` always does),
 * and every variable otherwise. Hands back every problem found, without throwing.
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
    const [baseline, ...later] = entries.map(({ permutation, selector }) => ({
        selector,
        declared: declarations(permutation, variable, fluid),
    }));
    if (!baseline) return { files: [], diagnostics };

    const inEffect = new Map(baseline.declared.map(({ name, value }) => [name, value]));
    const blocks = [
        baseline,
        ...later.map(({ selector, declared }) => ({
            selector,
            declared: appliesWherever(baseline.selector, selector)
                ? declared.filter(({ name, value }) => inEffect.get(name) !== value)
                : declared,
        })),
    ].flatMap(({ selector, declared }) => (declared.length > 0 ? [block(selector, declared)] : []));
    const files =
        blocks.length > 0 ? [{ path: config.variables.path, css: `${blocks.join("\n\n")}\n` }] : [];
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

function toWrite(
    doc: Document,
    config: InternalConfig,
): { permutation: Permutation; selector: string | string[] }[] {
    const listed = config.variables.permutations ?? [];
    if (listed.length === 0) {
        return doc.permutations.map((permutation) => ({
            permutation,
            selector: derivedSelector(doc, permutation.input),
        }));
    }
    return listed.flatMap(({ input, selector }) => {
        const permutation = permutationFor(doc, input);
        return permutation ? [{ permutation, selector }] : [];
    });
}

function derivedSelector(doc: Document, input: Input): string {
    const changed = Object.entries(input).find(
        ([name, context]) => context !== doc.modifiers[name]?.default,
    );
    return changed ? `[data-${changed[0]}="${changed[1]}"]` : ":root";
}

function appliesWherever(earlier: string | string[], later: string | string[]): boolean {
    const [reach, target] = [earlier, later].map((each) => [each].flat().join(","));
    return reach === ":root" || reach === target;
}

function block(selector: string | string[], declared: Declaration[]): string {
    const lines = declared.map(({ name, value }) => `    ${name}: ${value};`);
    return `${[selector].flat().join(",\n")} {\n${lines.join("\n")}\n}`;
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
