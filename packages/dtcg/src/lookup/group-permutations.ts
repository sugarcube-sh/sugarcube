import type { DesignTokens } from "../model/design-tokens.js";
import type { Permutation } from "../model/permutation.js";
import type { PermutationGroup } from "../model/reference.js";
import { makePermutations } from "../model/permutations.js";
import { sameList } from "../model/location.js";

export function groupPermutationsBy<Result>(
    tokens: DesignTokens,
    fn: (permutation: Permutation) => Result,
): readonly PermutationGroup<Result>[] {
    const groups: { result: Result; permutations: Permutation[] }[] = [];
    for (const permutation of tokens.permutations) {
        const result = fn(permutation);
        const same = groups.find((each) => sameResult(each.result, result));
        if (same) same.permutations.push(permutation);
        else groups.push({ result, permutations: [permutation] });
    }
    return groups.map(({ result, permutations }) => ({
        result,
        permutations: makePermutations(permutations, tokens.permutations),
    }));
}

function sameResult(a: unknown, b: unknown): boolean {
    return a === b || (Array.isArray(a) && Array.isArray(b) && sameList(a, b));
}
