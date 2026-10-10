import type { Document, Edge, Input, Permutation, Related, Token } from "../index.js";
import { permutation as permutationFor } from "./permutation.js";

export type Index = (permutation: Permutation) => Map<string, Set<string>>;

export type OnPermutation<O> = [permutation: Permutation, path: string | string[], options?: O];

export type OnDocument<O> = [doc: Document, path: string | string[], input?: Input, options?: O];

export function indexBy(pair: (edge: Edge) => [key: string, value: string]): Index {
    const built = new WeakMap<Permutation, Map<string, Set<string>>>();
    return (permutation) => {
        const cached = built.get(permutation);
        if (cached) return cached;
        const index = new Map<string, Set<string>>();
        for (const edge of permutation.edges) {
            const [key, value] = pair(edge);
            const values = index.get(key) ?? new Set<string>();
            values.add(value);
            index.set(key, values);
        }
        built.set(permutation, index);
        return index;
    };
}

export function related<O extends { transitive?: boolean }>(
    index: Index,
    args: OnPermutation<O> | OnDocument<O>,
): Token[] | Related[] {
    if (onPermutation(args)) {
        const [permutation, path, options] = args;
        return inPermutation(index, permutation, path, options?.transitive ?? false);
    }
    const [doc, path, input, options] = args;
    const named = input === undefined ? undefined : permutationFor(doc, input);
    const chosen = input === undefined ? doc.permutations : named ? [named] : [];
    const found = new Map<string, Input[]>();
    for (const permutation of chosen) {
        for (const each of inPermutation(index, permutation, path, options?.transitive ?? false)) {
            const inputs = found.get(each.path) ?? [];
            inputs.push(permutation.input);
            found.set(each.path, inputs);
        }
    }
    return [...found].map(([reached, inputs]) => ({ path: reached, in: inputs }));
}

function onPermutation<O>(args: OnPermutation<O> | OnDocument<O>): args is OnPermutation<O> {
    return !("permutations" in args[0]);
}

function inPermutation(
    index: Index,
    permutation: Permutation,
    path: string | string[],
    transitive: boolean,
): Token[] {
    const next = index(permutation);
    const asked = new Set([path].flat());
    const reached = new Set<string>();
    const waiting = [...asked];
    for (const each of waiting) {
        for (const found of next.get(each) ?? []) {
            if (asked.has(found) || reached.has(found)) continue;
            reached.add(found);
            if (transitive) waiting.push(found);
        }
    }
    return permutation.tokens.filter((each) => reached.has(each.path));
}
