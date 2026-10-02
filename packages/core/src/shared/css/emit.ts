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
import type { InternalConfig } from "../../types/config.js";
import type { CSSFileOutput } from "../../types/generate.js";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { createVariableNameResolver } from "../resolve-variable-name.js";
import { renderResolved } from "./values.js";

/**
 * Writes the design system's CSS variables, one file per output path, named from the config's
 * `prefix` or `variableName`, with every reference to a token that has its own variable written
 * as `var()`. The first permutation writes every variable; each later one writes only those whose
 * value differs, under its own selector. Hands back every problem found, without throwing.
 *
 * @example
 * const doc = await read(config.resolver, readOptions(config));
 * const { files, diagnostics } = emitCSS(doc, config);
 */
export function emitCSS(
    doc: Document,
    config: InternalConfig,
): { files: CSSFileOutput; diagnostics: Diagnostic[] } {
    const nameOf = createVariableNameResolver(config.variables);
    const [baseline, ...later] = toWrite(doc, config).map(({ permutation, selector }) => ({
        selector,
        declared: declarations(doc, permutation, nameOf),
    }));
    if (!baseline) return { files: [], diagnostics: doc.diagnostics };

    const inEffect = new Map(baseline.declared.map(({ name, value }) => [name, value]));
    const blocks = [
        baseline,
        ...later.map(({ selector, declared }) => ({
            selector,
            declared: declared.filter(({ name, value }) => inEffect.get(name) !== value),
        })),
    ].flatMap(({ selector, declared }) => (declared.length > 0 ? [block(selector, declared)] : []));
    const files =
        blocks.length > 0 ? [{ path: config.variables.path, css: `${blocks.join("\n\n")}\n` }] : [];
    return { files, diagnostics: doc.diagnostics };
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

function block(selector: string | string[], declared: Declaration[]): string {
    const lines = declared.map(({ name, value }) => `    ${name}: ${value};`);
    return `${[selector].flat().join(",\n")} {\n${lines.join("\n")}\n}`;
}

interface Declaration {
    name: string;
    value: string;
}

function declarations(
    doc: Document,
    permutation: Permutation,
    nameOf: (path: string) => string,
): Declaration[] {
    const emitted = (each: Token | undefined): each is Token =>
        each !== undefined && !each.invalid && !isPrivate(permutation.sources[each.source.index]);
    return permutation.tokens.flatMap((each) => {
        if (!emitted(each) || each.resolved === undefined) return [];
        const target = isAlias(each.value)
            ? token(doc, each.value.alias, permutation.input)
            : undefined;
        const value = emitted(target) ? `var(--${nameOf(target.path)})` : renderResolved(each);
        return value === undefined ? [] : [{ name: `--${nameOf(each.path)}`, value }];
    });
}

function isPrivate(source: Source | undefined): boolean {
    const ours = source?.extensions?.[SUGARCUBE_NAMESPACE];
    return typeof ours === "object" && ours !== null && "emit" in ours && ours.emit === false;
}
