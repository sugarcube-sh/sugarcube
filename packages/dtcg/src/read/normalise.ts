import type { Diagnostic, Group, Permutation, Token, TokenBase, TokenType } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { applyExtends } from "./extends.js";
import { inheritedDeprecation, inheritedType } from "./inherit.js";
import { type Merged, type MergedGroup, type MergedToken, merge } from "./merge.js";
import { type ValueReader, createValueReader } from "./parse-value.js";
import type { LoadedPermutation } from "./permutations.js";
import type { LoadedSource } from "./sources.js";
import { type SourceContents, walkSource } from "./walk.js";

// Walks each source once, then merges each permutation's sources in resolution order
// into its tokens and groups.
export function normalisePermutations(
    permutations: LoadedPermutation[],
    diagnostics: Diagnostic[],
): Permutation[] {
    const readValue = createValueReader(diagnostics);
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
        applyExtends(merged, index, diagnostics);
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
                return [[token.path, toToken(token, type, merged, readValue)]];
            }),
        );
        const groups = Object.fromEntries(
            [...merged.groups.values()].map((group) => [group.path, toGroup(group)]),
        );
        return { input, label, sources: sources.map(({ source }) => source), tokens, groups };
    });
}

function toToken<T extends TokenType>(
    token: MergedToken,
    type: T,
    merged: Merged,
    readValue: ValueReader,
): Token {
    const deprecated = inheritedDeprecation(token, merged);
    const built: TokenBase<T> = {
        path: token.path,
        type,
        ...(token.description !== undefined && { description: token.description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(token.extensions && { extensions: token.extensions }),
        source: { index: token.index, at: token.at },
        authored: { value: token.authored, typeDeclared: token.type !== undefined },
        ...(token.inherited && { inherited: token.inherited }),
    };
    const read = readValue(token, type);
    if (read.ok) built.value = read.value;
    else built.invalid = true;
    return built as Token;
}

function toGroup(group: MergedGroup): Group {
    const { path, type, description, deprecated, extensions, declaredIn, inherited } = group;
    return {
        path,
        ...(type !== undefined && type !== "unusable" && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions }),
        declaredIn,
        ...(inherited && { inherited }),
    };
}
