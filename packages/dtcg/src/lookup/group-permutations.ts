import type { DesignTokens, Permutation, PermutationGroup } from "../model.js";
import { makePermutations } from "../read/make-permutations.js";
import { sameList } from "../read/same-object.js";

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
    const groups: { result: Result; gave: Permutation[] }[] = [];
    for (const permutation of tokens.permutations) {
        const result = fn(permutation);
        const same = groups.find((each) => sameResult(each.result, result));
        if (same) same.gave.push(permutation);
        else groups.push({ result, gave: [permutation] });
    }
    return groups.map(({ result, gave }) => ({
        result,
        permutations: makePermutations(gave, tokens.permutations),
    }));
}

function sameResult(a: unknown, b: unknown): boolean {
    return a === b || (Array.isArray(a) && Array.isArray(b) && sameList(a, b));
}
