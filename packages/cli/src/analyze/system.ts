import { type Permutation, type Token, defaultPermutation } from "@sugarcube-sh/dtcg";
import type { Built } from "../build.js";

export interface System {
    permutations: Permutation[];
    tokens: Map<string, Token>;
    defaultPermutation?: Permutation;
}

export function systemOf({ doc, declared }: Built): System {
    const permutations = [...new Set(declared.entries.map(({ permutation }) => permutation))];
    const tokens = new Map<string, Token>();
    for (const permutation of permutations) {
        for (const each of permutation.tokens) {
            if (!tokens.has(each.path)) tokens.set(each.path, each);
        }
    }
    const fallback = defaultPermutation(doc);
    return {
        permutations,
        tokens,
        ...(fallback && permutations.includes(fallback) && { defaultPermutation: fallback }),
    };
}
