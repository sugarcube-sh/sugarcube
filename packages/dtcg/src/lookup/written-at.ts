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

export function writtenAtIn(tokens: DesignTokens, path: string): DefinitionInPermutations[] {
    const found = new Map<Span, { sources: Source[]; readIn: Permutation[]; first: Definition }>();
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
                found.set(span, { sources: [source], readIn: [permutation], first: place });
                continue;
            }
            if (!known.sources.includes(source)) known.sources.push(source);
            known.readIn.push(permutation);
        }
    }
    return [...found].map(([span, { sources, readIn, first }]) => ({
        span,
        get jsonPath() {
            return jsonPathIn(tokens, span);
        },
        get asWritten() {
            return first.asWritten;
        },
        sources,
        permutations: permutationsOf(readIn, tokens.permutations),
        winsIn: permutationsOf(
            readIn.filter((permutation) => {
                const winner = permutation.getToken(path)?.winningDefinition;
                return winner !== undefined && getSpan(tokens, winner) === span;
            }),
            tokens.permutations,
        ),
    }));
}
