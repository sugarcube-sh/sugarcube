import { type DesignTokens, tokenPath } from "@sugarcube-sh/dtcg";
import { apply } from "./apply.js";
import { exceptionMessages } from "./error-messages.js";
import type { FileOp, OperationResult, Operation } from "./index.js";

type AcceptedResult = Extract<OperationResult, { ops: readonly FileOp[] }>;

/**
 * Combines several operations into one.
 *
 * They're committed and undone together. Each is passed the design tokens the ones before it leave. Answering a question from one
 * carries on with the rest.
 *
 * @param tokens - The design tokens to edit.
 * @param operations - The operations, in order, such as `(current) => remove(current, path)`.
 *
 * @example
 * // Change color.primary, then rename it
 * combine(tokens, [
 *     (current) => setValue(current, "color.primary", "{color.blue.300}"),
 *     (current) => rename(current, "color.primary", "brand"),
 * ]).ops?.map((op) => op.kind)
 * // => ["set", "rename-key", "rename-key", "set"]
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
