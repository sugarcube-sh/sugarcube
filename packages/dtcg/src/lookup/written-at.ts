import type {
    DesignTokens,
    Permutation,
    Place,
    PlaceInPermutations,
    Source,
    Span,
} from "../index.js";
import { permutationsOf } from "../read/permutations-of.js";
import { jsonPathIn } from "./json-path.js";

export function writtenAtIn(tokens: DesignTokens, path: string): PlaceInPermutations[] {
    const found = new Map<Span, { sources: Source[]; readIn: Permutation[]; first: Place }>();
    for (const permutation of tokens.permutations) {
        const places = [
            ...(permutation.token(path)?.writtenAt ?? []),
            ...(permutation.group(path)?.writtenAt ?? []),
        ];
        for (const place of places) {
            const { source } = place;
            const span = tokens.spanOf(place);
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
        get written() {
            return first.written;
        },
        sources,
        readIn: permutationsOf(readIn, tokens.permutations),
        winsIn: permutationsOf(
            readIn.filter((permutation) => {
                const winner = permutation.token(path)?.valueFrom;
                return winner !== undefined && tokens.spanOf(winner) === span;
            }),
            tokens.permutations,
        ),
    }));
}
