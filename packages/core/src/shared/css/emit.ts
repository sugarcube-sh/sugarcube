import {
    type Document,
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
 * as `var()`.
 *
 * @example
 * const doc = await read(config.resolver, readOptions(config));
 * const files = emitCSS(doc, config);
 */
export function emitCSS(doc: Document, config: InternalConfig): CSSFileOutput {
    const [listed] = config.variables.permutations ?? [];
    const baseline = listed ? permutationFor(doc, listed.input) : doc.permutations[0];
    if (!baseline) return [];

    const nameOf = createVariableNameResolver(config.variables);
    const lines = declarations(doc, baseline, nameOf);
    if (lines.length === 0) return [];
    const selector = listed?.selector ?? ":root";
    const block = `${[selector].flat().join(",\n")} {\n${lines.join("\n")}\n}`;
    return [{ path: listed?.path ?? config.variables.path, css: `${block}\n` }];
}

function declarations(
    doc: Document,
    permutation: Permutation,
    nameOf: (path: string) => string,
): string[] {
    const emitted = (each: Token | undefined): each is Token =>
        each !== undefined && !each.invalid && !isPrivate(permutation.sources[each.source.index]);
    return permutation.tokens.flatMap((each) => {
        if (!emitted(each) || each.resolved === undefined) return [];
        const target = isAlias(each.value)
            ? token(doc, each.value.alias, permutation.input)
            : undefined;
        const value = emitted(target) ? `var(--${nameOf(target.path)})` : renderResolved(each);
        return value === undefined ? [] : [`    --${nameOf(each.path)}: ${value};`];
    });
}

function isPrivate(source: Source | undefined): boolean {
    const ours = source?.extensions?.[SUGARCUBE_NAMESPACE];
    return typeof ours === "object" && ours !== null && "emit" in ours && ours.emit === false;
}
