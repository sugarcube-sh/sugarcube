import type { Document, Input, Permutation, Related, Token } from "../index.js";
import { permutation as permutationFor } from "./permutation.js";

const referredBy = new WeakMap<Permutation, Map<string, Set<string>>>();

function referredByIn(permutation: Permutation): Map<string, Set<string>> {
    const cached = referredBy.get(permutation);
    if (cached) return cached;
    const built = new Map<string, Set<string>>();
    for (const { from, to } of permutation.edges) {
        const froms = built.get(to) ?? new Set<string>();
        froms.add(from);
        built.set(to, froms);
    }
    referredBy.set(permutation, built);
    return built;
}

export interface ReferrersOptions {
    /**
     * Include tokens that refer to it through others, however indirectly. Safe with loops.
     * @default false
     */
    transitive?: boolean;
}

/**
 * The tokens that refer to this one, or to any of several, in file order, in a permutation you
 * already hold. A pointer into part of a token's value counts as referring to that token. The
 * tokens asked about are never among them, even in a loop.
 *
 * @example
 * referrers(permutation, "color.brand")                        // color.danger, border.focus
 * referrers(permutation, "palette.red", { transitive: true })   // everything a change would reach
 * referrers(permutation, ["color.brand", "color.surface"])    // what refers to either
 */
export function referrers(
    permutation: Permutation,
    path: string | string[],
    options?: ReferrersOptions,
): Token[];
/**
 * The tokens that refer to this one, or to any of several, across a document: each path once,
 * with the permutations it refers in, in the order they are first met.
 * @param input Only this permutation. Left out: every permutation.
 *
 * @example
 * referrers(doc, "palette.red.600")                     // everywhere
 * referrers(doc, "palette.red.600", { theme: "dark" })  // in dark only
 */
export function referrers(
    doc: Document,
    path: string | string[],
    input?: Input,
    options?: ReferrersOptions,
): Related[];
export function referrers(...args: OnPermutation | OnDocument): Token[] | Related[] {
    if (onPermutation(args)) {
        const [permutation, path, options] = args;
        return inPermutation(permutation, path, options ?? {});
    }
    const [doc, path, input, options] = args;
    const named = input === undefined ? undefined : permutationFor(doc, input);
    const chosen = input === undefined ? doc.permutations : named ? [named] : [];
    const found = new Map<string, Input[]>();
    for (const permutation of chosen) {
        for (const each of inPermutation(permutation, path, options ?? {})) {
            const inputs = found.get(each.path) ?? [];
            inputs.push(permutation.input);
            found.set(each.path, inputs);
        }
    }
    return [...found].map(([referrer, inputs]) => ({ path: referrer, in: inputs }));
}

type OnPermutation = [
    permutation: Permutation,
    path: string | string[],
    options?: ReferrersOptions,
];
type OnDocument = [
    doc: Document,
    path: string | string[],
    input?: Input,
    options?: ReferrersOptions,
];

function onPermutation(args: OnPermutation | OnDocument): args is OnPermutation {
    return !("permutations" in args[0]);
}

function inPermutation(
    permutation: Permutation,
    path: string | string[],
    { transitive = false }: ReferrersOptions,
): Token[] {
    const index = referredByIn(permutation);
    const asked = new Set([path].flat());
    const reached = new Set<string>();
    const waiting = [...asked];
    for (const next of waiting) {
        for (const from of index.get(next) ?? []) {
            if (asked.has(from) || reached.has(from)) continue;
            reached.add(from);
            if (transitive) waiting.push(from);
        }
    }
    return permutation.tokens.filter((each) => reached.has(each.path));
}
