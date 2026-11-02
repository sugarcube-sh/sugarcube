import type {
    DesignTokens,
    Permutation,
    Definition,
    DefinitionInPermutations,
    Source,
    Span,
} from "../model.js";
import { permutationsOf } from "../read/permutations-of.js";
import { jsonPathIn } from "./json-path.js";
import { getSpan } from "./editor.js";

export function definitionsIn(tokens: DesignTokens, path: string): DefinitionInPermutations[] {
    const found = new Map<
        Span,
        { sources: Source[]; permutations: Permutation[]; first: Definition }
    >();
    for (const permutation of tokens.permutations) {
        const places = [
            ...(permutation.getToken(path)?.definitions ?? []),
            ...(permutation.getGroup(path)?.definitions ?? []),
        ];
        for (const place of places) {
            const { source } = place;
            const span = getSpan(tokens, place);
            const known = found.get(span);
            if (!known) {
                found.set(span, { sources: [source], permutations: [permutation], first: place });
                continue;
            }
            if (!known.sources.includes(source)) known.sources.push(source);
            known.permutations.push(permutation);
        }
    }
    return [...found].map(([span, { sources, permutations, first }]) => ({
        span,
        get jsonPath() {
            return jsonPathIn(tokens, span);
        },
        get asWritten() {
            return first.asWritten;
        },
        sources,
        permutations: permutationsOf(permutations, tokens.permutations),
        winsIn: permutationsOf(
            permutations.filter((permutation) => {
                const winner = permutation.getToken(path)?.winningDefinition;
                return winner !== undefined && getSpan(tokens, winner) === span;
            }),
            tokens.permutations,
        ),
    }));
}
