import type { Document, Token, TokenView } from "../index.js";
import { defaultPermutation } from "./permutation.js";

const views = new WeakMap<Document, readonly TokenView[]>();

/**
 * Every token once, each with its value in every permutation, in file order. Tokens in the default
 * permutation come first; a token only other permutations have follows, where it first appears.
 * Every call returns the same list, so it is read-only: sort a copy, with `toSorted`.
 *
 * @example
 * for (const t of byToken(doc)) row(t.path, t.default?.resolved, t.permutations.dark?.resolved);
 */
export function byToken(doc: Document): readonly TokenView[] {
    const cached = views.get(doc);
    if (cached) return cached;
    const base = defaultPermutation(doc);
    const found = new Map<string, TokenView>();
    const viewOf = ({ path, type }: Token) => {
        const existing = found.get(path);
        if (existing) return existing;
        const created: TokenView = { path, type, permutations: {} };
        found.set(path, created);
        return created;
    };
    for (const each of base?.tokens ?? []) viewOf(each).default = each;
    for (const { label, tokens } of doc.permutations) {
        for (const each of tokens) viewOf(each).permutations[label] = each;
    }
    const built = [...found.values()];
    views.set(doc, built);
    return built;
}
