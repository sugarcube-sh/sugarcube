import type { Diagnostic, Group, Permutation, Token, TokenType } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { inheritedDeprecation, inheritedType } from "./inherit.js";
import { type Merged, type MergedGroup, type MergedToken, merge } from "./merge.js";
import type { LoadedPermutation } from "./permutations.js";
import type { LoadedSource } from "./sources.js";
import { type SourceContents, walkSource } from "./walk.js";

// Walks each source once, then merges each permutation's sources in resolution order
// into its tokens and groups.
export function normalisePermutations(
    permutations: LoadedPermutation[],
    diagnostics: Diagnostic[],
): Permutation[] {
    const walked = new Map<string, SourceContents | undefined>();
    const walk = (loaded: LoadedSource) => {
        const key = JSON.stringify([loaded.file, loaded.pointer, loaded.overriddenKeys]);
        if (!walked.has(key)) walked.set(key, walkSource(loaded, diagnostics));
        return walked.get(key);
    };

    return permutations.map(({ input, label, sources }, index) => {
        const merged = merge(
            sources.map(({ loaded }) => walk(loaded)),
            index,
            diagnostics,
        );
        const tokens = Object.fromEntries(
            [...merged.tokens.values()].flatMap((token) => {
                if (token.type === undefined && token.isReference) return [];
                const type = inheritedType(token, merged);
                if (type === "unusable") return [];
                if (type === undefined) {
                    const where = { at: token.at, path: token.path, permutation: index };
                    diagnostics.push(diagnostic("missing-type", {}, where));
                    return [];
                }
                return [[token.path, toToken(token, type, merged)]];
            }),
        );
        const groups = Object.fromEntries(
            [...merged.groups.values()].map((group) => [group.path, toGroup(group)]),
        );
        return { input, label, sources: sources.map(({ source }) => source), tokens, groups };
    });
}

function toToken(token: MergedToken, type: TokenType, merged: Merged): Token {
    const deprecated = inheritedDeprecation(token, merged);
    return {
        path: token.path,
        type,
        ...(token.description !== undefined && { description: token.description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(token.extensions && { extensions: token.extensions }),
        source: { index: token.index, at: token.at },
        authored: { value: token.authored, typeDeclared: token.type !== undefined },
    };
}

function toGroup(group: MergedGroup): Group {
    const { path, type, description, deprecated, extensions, declaredIn } = group;
    return {
        path,
        ...(type !== undefined && type !== "unusable" && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions }),
        declaredIn,
    };
}
