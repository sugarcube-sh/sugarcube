import type { DesignTokens, JsonValue } from "@sugarcube-sh/dtcg";
import { createWriteOps } from "./file-text.js";
import type { OperationResult } from "./index.js";
import { createQuestion, getDefinitionMembers, findPropertyPlacement } from "./placement.js";

export function setProperty(
    tokens: DesignTokens,
    path: string,
    key: "$description" | "$deprecated",
    value: JsonValue | null,
    chosenFile?: string,
): OperationResult {
    const copies = getDefinitionMembers(tokens, path);
    if ("refusal" in copies) return copies;
    if (copies.kind === "token") {
        const ops = copies.members.flatMap((at) => createWriteOps(tokens, at, [key], value));
        return { ops, affectedPermutations: copies.affectedPermutations, moves: [] };
    }
    const placement = findPropertyPlacement(tokens, path, key, copies.members, chosenFile);
    if ("choice" in placement) {
        return createQuestion(placement.choice, (file) =>
            setProperty(tokens, path, key, value, file),
        );
    }
    if ("refusal" in placement) return placement;
    const ops = createWriteOps(tokens, placement.at, [key], value);
    return { ops, affectedPermutations: placement.affectedPermutations, moves: [] };
}
