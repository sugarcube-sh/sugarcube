import { type DesignTokens, type ReferenceInPermutations, tokenPath } from "@sugarcube-sh/dtcg";
import { refuse } from "./error-messages.js";
import type { FileOp, OperationResult } from "./index.js";
import { getDefinitionMembers } from "./placement.js";
import type { Member } from "./file-text.js";
import { getJsonAt } from "@sugarcube-sh/dtcg/editor";

/**
 * Renames a token or group and every reference to it.
 *
 * It rewrites references in every file, including `$ref` pointers and `$extends`. A reference a generator makes is
 * left as it is, and its token is in `pathsWithBrokenReferences`.
 *
 * @param tokens - The design tokens to edit.
 * @param path - The token or group, such as `"color.primary"`.
 * @param newName - Its new name, without its group, such as `"brand"`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#curly-brace-syntax-token-references | Format 7.1.1, Curly brace syntax}
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#json-pointer-syntax-required-support | Format 7.1.2, JSON Pointer syntax}
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#extending-groups | Format 6.4, Extending Groups}
 *
 * @example
 * // button.background's reference follows the rename
 * rename(tokens, "color.primary", "brand").ops?.at(-1)
 * // => { kind: "set", file: "color.json", jsonPath: ["button", "background", "$value"],
 * //      value: "{color.brand}", was: "{color.primary}" }
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
