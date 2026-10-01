import type { Diagnostic, Group, Input, ParseResult, Source, TokenType } from "../index.js";
import { diagnostic } from "./diagnostics.js";
import { applyExtends } from "./extends.js";
import { inheritedType } from "./inherit.js";
import { type Merged, type MergedGroup, type MergedToken, merge } from "./merge.js";
import type { ValueReader } from "./parse-value.js";
import type { LoadedPermutation } from "./permutations.js";
import type { LoadedSource } from "./sources.js";
import { type SourceContents, walkSource } from "./walk.js";

export interface NormalisedToken {
    token: MergedToken;
    type?: TokenType;
    read?: ParseResult<unknown>;
}

export interface NormalisedPermutation {
    input: Input;
    label: string;
    sources: Source[];
    merged: Merged;
    tokens: Map<string, NormalisedToken>;
    groups: Group[];
}

// Walks each source once, then merges each permutation's sources in resolution order
// into its tokens and groups.
export function normalisePermutations(
    permutations: LoadedPermutation[],
    readValue: ValueReader,
    diagnostics: Diagnostic[],
    generate: (merged: Merged, permutation: number) => void,
): NormalisedPermutation[] {
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
        generate(merged, index);
        const tokens = new Map<string, NormalisedToken>();
        for (const token of merged.tokens.values()) {
            if (token.type === undefined && token.isReference) {
                tokens.set(token.path, { token });
                continue;
            }
            const type = inheritedType(token, merged);
            if (type === "unusable") continue;
            if (type === undefined) {
                const where = { at: token.at, path: token.path, permutation: index };
                diagnostics.push(diagnostic("missing-type", {}, where));
                continue;
            }
            tokens.set(token.path, { token, type, read: readValue(token, type) });
        }
        const groups = [...merged.groups.values()].map(toGroup);
        const publicSources = sources.map(({ source }) => source);
        return { input, label, sources: publicSources, merged, tokens, groups };
    });
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
