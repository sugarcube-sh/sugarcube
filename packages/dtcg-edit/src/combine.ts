import { type DesignTokens, tokenPath } from "@sugarcube-sh/dtcg";
import { apply } from "./apply.js";
import { exceptionMessages } from "./error-messages.js";
import type { FileOp, OperationResult, Operation } from "./index.js";

type AcceptedResult = Extract<OperationResult, { ops: readonly FileOp[] }>;

/**
 * Puts several edits together as one: each operation is given the design tokens the operations
 * before it leave, and the result holds every operation's edits, so they are committed, undone or
 * refused as a whole. An operation that asks a question makes the whole ask it, and answering
 * carries on with the operations after it; one that is refused refuses the whole, with its reason.
 *
 * @example
 * const edit = combine(tokens, unused.map((path) => (current) => remove(current, path)));
 */
export function combine(tokens: DesignTokens, operations: readonly Operation[]): OperationResult {
    return runOperations(tokens, tokens, operations, []);
}

function runOperations(
    tokens: DesignTokens,
    from: DesignTokens,
    operations: readonly Operation[],
    before: AcceptedResult[],
): OperationResult {
    let current = from;
    const operationResults = [...before];
    for (const [index, operation] of operations.entries()) {
        const result = operation(current);
        if (result.refusal) return result;
        if (result.question) {
            const { question } = result;
            const rest = operations.slice(index + 1);
            const answer = (file: string) =>
                runOperations(
                    tokens,
                    current,
                    [() => question.answer(file), ...rest],
                    operationResults,
                );
            return { question: { ...question, answer } };
        }
        const next = apply(current, result.ops);
        if (next.conflicts) throw new Error(exceptionMessages.operationDoesNotFit);
        current = next.tokens;
        operationResults.push(result);
    }
    return mergeResults(tokens, current, operationResults);
}

function mergeResults(
    tokens: DesignTokens,
    finalTokens: DesignTokens,
    made: AcceptedResult[],
): OperationResult {
    const affected = new Set(
        made.flatMap(({ affectedPermutations }) =>
            affectedPermutations.map(({ input }) => tokens.getPermutation(input)),
        ),
    );
    const brokenPaths = made.flatMap(({ pathsWithBrokenReferences: broken = [] }, index) => {
        const later = made.slice(index + 1).flatMap(({ moves }) => moves);
        return broken.map((path) => tokenPath.applyMoves(path, later));
    });
    return {
        ops: made.flatMap(({ ops }) => ops),
        affectedPermutations: tokens.permutations.select((each) => affected.has(each)),
        pathsWithBrokenReferences: [...new Set(brokenPaths)].filter((path) =>
            finalTokens.getDiagnostics(path).some(({ kind }) => kind === "missing-reference"),
        ),
        moves: made.flatMap(({ moves }) => moves),
    };
}
