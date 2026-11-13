import type { DesignTokens } from "../model/design-tokens.js";
import type { Permutation } from "../model/permutation.js";
import type { PermutationGroup } from "../model/reference.js";
import { makePermutations } from "../model/permutations.js";
import { sameList } from "../model/location.js";

/**
 * Groups the permutations by what `fn` returns in each.
 *
 * Permutations where `fn` returns the same result share a group. Have it return a string or a
 * number, so equal results match.
 *
 * @param tokens - The tokens whose permutations to group.
 * @param fn - Run in each permutation, such as
 * `(p) => toCSSValue(p.getToken("color.primary"))`.
 *
 * @example
 * // color.primary differs, so two groups
 * groupPermutationsBy(tokens, (p) => toCSSValue(p.getToken("color.primary")))
 * // => [
 * //     { result: "rgb(51 102 204)", permutations: [light] },
 * //     { result: "rgb(102 153 255)", permutations: [dark] },
 * // ]
 *
 * @example
 * // color.blue.500 is the same in both, so one group
 * groupPermutationsBy(tokens, (p) => toCSSValue(p.getToken("color.blue.500")))
 * // => [{ result: "rgb(51 102 204)", permutations: [light, dark] }]
 */
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
