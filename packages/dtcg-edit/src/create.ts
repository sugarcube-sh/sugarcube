import { type DesignTokens, type JsonValue, tokenPath } from "@sugarcube-sh/dtcg";
import { exceptionMessages, refuse } from "./error-messages.js";
import type { FileOp, NewToken, OperationResult, ContextOptions } from "./index.js";
import { createQuestion, findNewPlacement } from "./placement.js";

/**
 * Creates a token or a group.
 *
 * It goes at the end of its group in a file that already writes that group. Otherwise a {@link Question} asks which file.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The new token or group, such as `"color.secondary"`.
 * @param token - The token, or `{ group: true }` for a group.
 * @param options - The context it's for, and `after`, the sibling to place it after.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#character-restrictions | Format 5.1.1, Character restrictions}
 *
 * @example
 * // A new token beside color.primary
 * create(tokens, "color.secondary", { $type: "color", $value: "{color.blue.300}" }).ops
 * // => [{ kind: "add", file: "color.json", jsonPath: ["color", "secondary"],
 * //       value: { $type: "color", $value: "{color.blue.300}" } }]
 */
export function create(
    tokens: DesignTokens,
    path: string,
    token: NewToken | { group: true },
    options: ContextOptions & { after?: string } = {},
): OperationResult {
    return createInFile(tokens, path, token, options);
}

function createInFile(
    tokens: DesignTokens,
    path: string,
    token: NewToken | { group: true },
    options: ContextOptions & { after?: string },
    chosenFile?: string,
): OperationResult {
    if (options.after !== undefined) throw new Error(exceptionMessages.notImplemented);
    for (const name of path.split(".")) {
        const problem = tokenPath.findNameProblem(name);
        if (problem) return refuse({ kind: "invalid-name", name, ...problem });
    }
    const placement = findNewPlacement(tokens, path, options, chosenFile);
    if ("choice" in placement) {
        return createQuestion(placement.choice, (file) =>
            createInFile(tokens, path, token, options, file),
        );
    }
    if (!("into" in placement)) return placement;
    const { into: file, affectedPermutations } = placement;

    const value: JsonValue =
        "group" in token
            ? {}
            : {
                  ...(token.$type !== undefined && { $type: token.$type }),
                  $value: token.$value,
                  ...(token.$description !== undefined && { $description: token.$description }),
              };
    const op: FileOp = { kind: "add", file, jsonPath: path.split("."), value };
    return { ops: [op], affectedPermutations, moves: [] };
}
