import type { AnswerInPermutations, DesignTokens, Permutation } from "../model.js";
import { permutationsOf } from "../read/permutations-of.js";
import { sameList } from "../read/same-object.js";

/**
 * Asks every permutation the same question, and lists each different answer once.
 *
 * Each answer comes with the permutations that gave it. Have `question` return a string or a
 * number, so answers that match are listed together.
 *
 * @param tokens - The tokens to ask.
 * @param question - Asked of each permutation, such as
 * `(p) => toCSSValue(p.getToken("color.primary"))`.
 *
 * @example
 * // color.primary differs, so two answers
 * askEveryPermutation(tokens, (p) => toCSSValue(p.getToken("color.primary")))
 * // => [
 * //     { answer: "rgb(51 102 204)", permutations: [light] },
 * //     { answer: "rgb(102 153 255)", permutations: [dark] },
 * // ]
 *
 * @example
 * // color.blue.500 is the same in both, so one answer
 * askEveryPermutation(tokens, (p) => toCSSValue(p.getToken("color.blue.500")))
 * // => [{ answer: "rgb(51 102 204)", permutations: [light, dark] }]
 */
export function askEveryPermutation<Answer>(
    tokens: DesignTokens,
    question: (permutation: Permutation) => Answer,
): readonly AnswerInPermutations<Answer>[] {
    const found: { answer: Answer; gave: Permutation[] }[] = [];
    for (const permutation of tokens.permutations) {
        const answer = question(permutation);
        const same = found.find((each) => sameAnswer(each.answer, answer));
        if (same) same.gave.push(permutation);
        else found.push({ answer, gave: [permutation] });
    }
    return found.map(({ answer, gave }) => ({
        answer,
        permutations: permutationsOf(gave, tokens.permutations),
    }));
}

function sameAnswer(a: unknown, b: unknown): boolean {
    return a === b || (Array.isArray(a) && Array.isArray(b) && sameList(a, b));
}
