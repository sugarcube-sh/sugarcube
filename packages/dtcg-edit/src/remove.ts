import { type DesignTokens, tokenPath } from "@sugarcube-sh/dtcg";
import type { FileOp, OpResult } from "./index.js";
import { refuse } from "./error-messages.js";
import { getDefinitionMembers } from "./placement.js";

/**
 * Removes a token or group from every file that writes it: the copy that wins, any copy an earlier
 * file writes that it replaces, and each context's own. Never refused for what refers to it: the
 * tokens and groups left referring to nothing are listed in `broken`.
 *
 * Refused, with the reason: a path that is neither a token nor a group, a token a generator makes,
 * or a token or group inherited through `$extends`.
 *
 * @example
 * const result = remove(tokens, "color.legacy");
 * if (result.broken?.length) warn(result.broken);
 */
export function remove(tokens: DesignTokens, path: string): OpResult {
    if (path === "") return refuse({ kind: "top-level" });
    const copies = getDefinitionMembers(tokens, path);
    if ("refused" in copies) return copies;

    const ops = copies.members.map(({ span, jsonPath, json }): FileOp => ({
        kind: "remove",
        file: span.file,
        jsonPath,
        was: json,
    }));
    const referringPaths = tokens.getReferencesTo(path).flatMap(({ ownerPaths }) => ownerPaths);
    const broken = [...new Set(referringPaths)].filter((owner) => !tokenPath.contains(path, owner));
    return { ops, alsoAffects: copies.alsoAffects, broken, moves: [] };
}
