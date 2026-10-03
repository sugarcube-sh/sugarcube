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
import type { Reported } from "../../types/diagnostics.js";
import type { CSSFileOutput } from "../../types/generate.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { SUGARCUBE_NAMESPACE } from "../extensions.js";
import { createVariableNameResolver } from "../resolve-variable-name.js";
import { type VariableFor, type Written, renderToken } from "./values.js";

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
    const diagnostics = doc.diagnostics.map(asReported);
    if (diagnostics.some(({ kind }) => kind === "default-required"))
        return { files: [], diagnostics };

    const nameOf = createVariableNameResolver(config.variables);
    const [baseline, ...later] = toWrite(doc, config).map(({ permutation, selector }) => ({
        selector,
        declared: declarations(permutation, nameOf),
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
        docs: "https://sugarcube.sh/errors/default-required",
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

function declarations(permutation: Permutation, nameOf: (path: string) => string): Declaration[] {
    const variable = (path: string) => `--${nameOf(path)}`;
    const writtenFor = new Map<Token, Written[] | undefined>();
    const written = (each: Token): Written[] | undefined => {
        if (!writtenFor.has(each)) {
            const source = permutation.sources[each.source.index];
            writtenFor.set(each, isPrivate(source) ? undefined : renderToken(each, variableFor));
        }
        return writtenFor.get(each);
    };
    const variableFor: VariableFor = (ref) => {
        const target = isAlias(ref) ? token(permutation, ref.alias) : undefined;
        return target && written(target) ? variable(target.path) : undefined;
    };
    return permutation.tokens.flatMap((each) =>
        (written(each) ?? []).map(({ suffix, value }) => ({
            name: `${variable(each.path)}${suffix}`,
            value,
        })),
    );
}

function isPrivate(source: Source | undefined): boolean {
    const ours = source?.extensions?.[SUGARCUBE_NAMESPACE];
    return typeof ours === "object" && ours !== null && "emit" in ours && ours.emit === false;
}
