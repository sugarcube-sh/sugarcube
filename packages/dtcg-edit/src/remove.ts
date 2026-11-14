import { type DesignTokens, tokenPath } from "@sugarcube-sh/dtcg";
import type { FileOp, OperationResult } from "./index.js";
import { refuse } from "./error-messages.js";
import { getDefinitionMembers } from "./placement.js";

/**
 * Removes a token or group from every file that writes it.
 *
 * References don't stop it. Tokens left with broken references are in
 * `pathsWithBrokenReferences`.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token or group, such as `"color.blue.300"`.
 *
 * @example
 * // dark.json's color.primary refers to color.blue.300
 * remove(tokens, "color.blue.300").pathsWithBrokenReferences
 * // => ["color.primary"]
 */
export function remove(tokens: DesignTokens, path: string): OperationResult {
    if (path === "") return refuse({ kind: "top-level" });
    const copies = getDefinitionMembers(tokens, path);
    if ("refusal" in copies) return copies;

    const ops = copies.members.map(({ span, jsonPath, json }): FileOp => ({
        kind: "remove",
        file: span.file,
        jsonPath,
        was: json,
    }));
    const referringPaths = tokens.getReferencesTo(path).flatMap(({ ownerPaths }) => ownerPaths);
    const pathsWithBrokenReferences = [...new Set(referringPaths)].filter(
        (owner) => !tokenPath.contains(path, owner),
    );
    return {
        ops,
        affectedPermutations: copies.affectedPermutations,
        pathsWithBrokenReferences,
        moves: [],
    };
}
