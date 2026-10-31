import { type DesignTokens, atOrWithin } from "@sugarcube-sh/dtcg";
import type { FileOp, OpResult } from "./index.js";
import { copiesOf } from "./placement.js";

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
    const copies = copiesOf(tokens, path);
    if ("refused" in copies) return copies;

    const ops = copies.places.map(({ span, jsonPath, written }): FileOp => ({
        kind: "remove",
        file: span.file,
        jsonPath,
        was: written,
    }));
    const users = tokens.permutations.flatMap((permutation) => permutation.usedBy(path));
    const broken = [...new Set(users.map((user) => user.path))].filter(
        (user) => !atOrWithin(user, path),
    );
    return { ops, alsoAffects: copies.alsoAffects, broken, moved: [] };
}
