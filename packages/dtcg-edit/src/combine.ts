import { type DesignTokens, tokenPath } from "@sugarcube-sh/dtcg";
import { apply } from "./apply.js";
import { thrown } from "./error-messages.js";
import type { FileOp, OpResult, Operation } from "./index.js";

type Made = Extract<OpResult, { ops: readonly FileOp[] }>;

/**
 * Puts several edits together as one: each operation is given the design tokens the operations
 * before it leave, and the result holds every operation's edits, so they are committed, undone or
 * refused as a whole. An operation that asks a question makes the whole ask it, and answering
 * carries on with the operations after it; one that is refused refuses the whole, with its reason.
 *
 * @example
 * const edit = combine(tokens, unused.map((path) => (current) => remove(current, path)));
 */
export function combine(tokens: DesignTokens, operations: readonly Operation[]): OpResult {
    return carriedOn(tokens, tokens, operations, []);
}

function carriedOn(
    tokens: DesignTokens,
    from: DesignTokens,
    operations: readonly Operation[],
    before: Made[],
): OpResult {
    let current = from;
    const made = [...before];
    for (const [index, operation] of operations.entries()) {
        const result = operation(current);
        if (result.refused) return result;
        if (result.question) {
            const { question } = result;
            const rest = operations.slice(index + 1);
            const answer = (file: string) =>
                carriedOn(tokens, current, [() => question.answer(file), ...rest], made);
            return { question: { ...question, answer } };
        }
        const next = apply(current, result.ops);
        if (next.conflicts) throw new Error(thrown.operationDoesNotFit);
        current = next.tokens;
        made.push(result);
    }
    return together(tokens, current, made);
}

function together(tokens: DesignTokens, last: DesignTokens, made: Made[]): OpResult {
    const affected = new Set(
        made.flatMap(({ alsoAffects }) =>
            alsoAffects.map(({ input }) => tokens.permutation(input)),
        ),
    );
    const left = made.flatMap(({ broken = [] }, index) => {
        const later = made.slice(index + 1).flatMap(({ moved }) => moved);
        return broken.map((path) => tokenPath.afterMoves(path, later));
    });
    return {
        ops: made.flatMap(({ ops }) => ops),
        alsoAffects: tokens.permutations.where((each) => affected.has(each)),
        broken: [...new Set(left)].filter((path) =>
            last.diagnosticsFor(path).some(({ kind }) => kind === "missing-reference"),
        ),
        moved: made.flatMap(({ moved }) => moved),
    };
}
