import type { AnswerInPermutations, DesignTokens, Permutation } from "../index.js";
import { permutationsOf } from "../read/permutations-of.js";
import { sameList } from "../read/same-object.js";

/**
 * Asks a question of every permutation, and gives each answer once, with the permutations that
 * gave it: for showing permutations side by side, such as a token's value in each, or which of
 * them agree.
 *
 * Two answers are the same when they are the same value (`===`), or lists of the same values in
 * the same order. A token or group the same in two permutations is one object in both, so asking
 * for it puts those permutations together; an answer built fresh each time, such as an object
 * made in the question, never matches another. Every permutation is in exactly one answer: one
 * without the token gives its own, usually `undefined`. Answers come in the order the
 * permutations first give them.
 *
 * For one answer across permutations, such as whether any permutation has a token, ask
 * `tokens.permutations` itself: it is a list, so `some`, `find` and `flatMap` work on it.
 *
 * @example
 * for (const { answer, permutations } of everyPermutation(tokens, (p) => p.token("color.text"))) {
 *   row(permutations.label, answer && cssValue(answer));
 * }
 *
 * @example
 * // the same in every permutation
 * everyPermutation(tokens, (p) => p.token("color.text")).length === 1
 */
export function everyPermutation<Answer>(
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
