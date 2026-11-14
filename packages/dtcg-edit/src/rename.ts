import { type DesignTokens, type ReferenceInPermutations, tokenPath } from "@sugarcube-sh/dtcg";
import { refuse } from "./error-messages.js";
import type { FileOp, OperationResult } from "./index.js";
import { getDefinitionMembers } from "./placement.js";
import type { Member } from "./file-text.js";
import { getJsonAt } from "@sugarcube-sh/dtcg/editor";

/**
 * Renames a token or group where each is written, and rewrites every reference to it or to
 * anything inside it, in whichever file it is written, the resolver too: `{…}` references,
 * `$ref` pointers (keeping their steps into the value), and `$extends`. Text that only looks like
 * a reference, such as a `$description` mentioning `{color.brand}`, is left alone. References are
 * found in the permutations the read built, so a read limited by `inputs` can miss one written in
 * a file only another permutation reads. `moved` gives the path that changed, which a session's
 * IDs and `tokens.getChangesSince` follow. A reference a generator makes is written in no file, so it is left
 * as it is, and its token is listed in `broken`.
 *
 * Refused, with the reason: a path that is neither a token nor a group, a name already taken or
 * one the spec forbids, a token a generator makes, or a token or group inherited through
 * `$extends`.
 *
 * @example
 * session.do(rename(session.tokens, "color.brand", "primary"));
 */
export function rename(tokens: DesignTokens, path: string, newName: string): OperationResult {
    const parent = tokenPath.getParent(path);
    if (parent === undefined) return refuse({ kind: "top-level" });
    const problem = tokenPath.findNameProblem(newName);
    if (problem) return refuse({ kind: "invalid-name", name: newName, ...problem });

    const copies = getDefinitionMembers(tokens, path);
    if ("refusal" in copies) return copies;
    const to = tokenPath.join(parent, newName);
    if (to === path)
        return { ops: [], affectedPermutations: copies.affectedPermutations, moves: [] };
    if (tokens.has(to)) return refuse({ kind: "taken", path: to });

    const moves = [{ from: path, to }];
    const keyOps = copies.members.map(({ span, jsonPath, json }): FileOp => ({
        kind: "rename-key",
        file: span.file,
        jsonPath,
        name: newName,
        was: json,
    }));
    const references = tokens.getReferencesTo(path);
    const referenceOps = references.filter(isInFile).flatMap((reference): FileOp[] => {
        const { span } = reference;
        const was = getJsonAt(tokens, span.file, reference.jsonPath);
        if (was === undefined) return [];
        const jsonPath = applyKeyRenames(
            { span, jsonPath: reference.jsonPath, json: was },
            copies.members,
            newName,
        );
        const value = reference.applyMoves(moves);
        return [{ kind: "set", file: span.file, jsonPath, value, was }];
    });
    const broken = [
        ...new Set(
            references.filter((each) => !isInFile(each)).flatMap(({ ownerPaths }) => ownerPaths),
        ),
    ];
    return {
        ops: [...keyOps, ...referenceOps],
        affectedPermutations: copies.affectedPermutations,
        pathsWithBrokenReferences: broken,
        moves: moves,
    };
}

function applyKeyRenames(member: Member, keys: Member[], name: string): Member["jsonPath"] {
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

function isInFile(reference: ReferenceInPermutations): boolean {
    const [owner] = reference.ownerPaths;
    return !reference.permutations.some((each) => owner && each.getToken(owner)?.generated);
}
