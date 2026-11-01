import { type DesignTokens, type JsonValue, tokenPath } from "@sugarcube-sh/dtcg";
import { refused } from "./error-messages.js";
import type { FileOp, NewToken, OpResult, Where } from "./index.js";
import { asked, newPlace } from "./placement.js";

/**
 * Creates a token or a group at `path`, at the end of the group it goes in; a path with no dot is
 * made at the top level.
 *
 * The new key goes in a file that context may write: without an `input`, a whole file every
 * permutation reads; with one, a whole file only that context reads. Of those, a file that already
 * writes the parent group is taken, so the new key sits beside its siblings; when no such file
 * settles it, the answer is a placement {@link Question}. A new group is written as `{}`.
 *
 * Written as given: a token whose type can't be worked out is still written, and the read
 * reports it. Refused, with the reason: a name the spec forbids, or an empty one; a path already
 * taken; a shared token made again for one context, which is an override ({@link setValue});
 * a group to go in that doesn't exist or is a token; or a context with no whole file of its own.
 *
 * @example
 * create(tokens, "color.brand.950", { $value: "{color.brand.900}" })
 * create(tokens, "color.raw", { group: true }, { input: { mode: "dark" } })
 */
export function create(
    tokens: DesignTokens,
    path: string,
    token: NewToken | { group: true },
    options: Where & { after?: string } = {},
): OpResult {
    return createIn(tokens, path, token, options);
}

function createIn(
    tokens: DesignTokens,
    path: string,
    token: NewToken | { group: true },
    options: Where & { after?: string },
    place?: string,
): OpResult {
    if (options.after !== undefined) throw new Error("not implemented yet");
    const parent = tokenPath.parent(path);
    const name = parent === undefined ? path : path.slice(parent.length + 1);
    if (name === "") return refused({ kind: "invalid-name", name });
    const character = tokenPath.invalidCharacter(name);
    if (character) return refused({ kind: "invalid-name", name, character });
    const placed = newPlace(tokens, path, options, place);
    if ("choose" in placed) {
        return asked(placed.choose, (file) => createIn(tokens, path, token, options, file));
    }
    if (!("into" in placed)) return placed;
    const { into: file, alsoAffects } = placed;

    const value: JsonValue =
        "group" in token
            ? {}
            : {
                  ...(token.$type !== undefined && { $type: token.$type }),
                  $value: token.$value,
                  ...(token.$description !== undefined && { $description: token.$description }),
              };
    const op: FileOp = { kind: "add", file, jsonPath: path.split("."), value };
    return { ops: [op], alsoAffects, moved: [] };
}
