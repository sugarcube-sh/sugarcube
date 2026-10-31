import {
    type DesignTokens,
    type ReferenceInPermutations,
    childPath,
    forbiddenInName,
    parentOf,
} from "@sugarcube-sh/dtcg";
import { refused } from "./error-messages.js";
import type { FileOp, OpResult } from "./index.js";
import { copiesOf } from "./placement.js";
import type { Member } from "./file-text.js";

/**
 * Renames a token or group where each is written, and rewrites every reference to it or to
 * anything inside it, in whichever file it is written, the resolver too: `{…}` references,
 * `$ref` pointers (keeping their steps into the value), and `$extends`. Text that only looks like
 * a reference, such as a `$description` mentioning `{color.brand}`, is left alone. References are
 * found in the permutations the read built, so a read limited by `inputs` can miss one written in
 * a file only another permutation reads. `moved` gives the path that changed, which a session's
 * ids and `tokens.diff` follow. A reference a generator makes is written in no file, so it is left
 * as it is, and its token is listed in `broken`.
 *
 * Refused, with the reason: a path that is neither a token nor a group, a name already taken or
 * one the spec forbids, a token a generator makes, or a token or group inherited through
 * `$extends`.
 *
 * @example
 * session.do(rename(session.tokens, "color.brand", "primary"));
 */
export function rename(tokens: DesignTokens, path: string, newName: string): OpResult {
    if (newName === "") return refused({ kind: "invalid-name", name: newName });
    const character = forbiddenInName(newName);
    if (character !== undefined) return refused({ kind: "invalid-name", name: newName, character });

    const copies = copiesOf(tokens, path);
    if ("refused" in copies) return copies;
    const to = childPath(parentOf(path), newName);
    if (to === path) return { ops: [], alsoAffects: copies.alsoAffects, moved: [] };
    if (tokens.has(to)) return refused({ kind: "taken", path: to });

    const moved = [{ from: path, to }];
    const keys = copies.places.map(({ span, jsonPath, written }): FileOp => ({
        kind: "renameKey",
        file: span.file,
        jsonPath,
        name: newName,
        was: written,
    }));
    const all = tokens.referencedBy(path);
    const references = all.filter(isWritten).flatMap((reference): FileOp[] => {
        const { span } = reference;
        const was = tokens.jsonAt(span.file, reference.jsonPath);
        if (was === undefined) return [];
        const jsonPath = afterKeys(
            { span, jsonPath: reference.jsonPath, written: was },
            copies.places,
            newName,
        );
        const value = reference.moved(moved);
        return [{ kind: "set", file: span.file, jsonPath, value, was }];
    });
    const broken = [...new Set(all.filter((each) => !isWritten(each)).map(({ from }) => from))];
    return { ops: [...keys, ...references], alsoAffects: copies.alsoAffects, broken, moved };
}

function afterKeys(member: Member, keys: Member[], name: string): Member["jsonPath"] {
    return keys.reduce((jsonPath, key) => {
        const inside =
            key.span.file === member.span.file &&
            key.jsonPath.length <= jsonPath.length &&
            key.jsonPath.every((step, index) => jsonPath[index] === step);
        return inside
            ? jsonPath.map((step, index) => (index === key.jsonPath.length - 1 ? name : step))
            : jsonPath;
    }, member.jsonPath);
}

function isWritten(reference: ReferenceInPermutations): boolean {
    return !reference.permutations.some((each) => each.token(reference.from)?.generated);
}
