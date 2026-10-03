import type { Document, Group, Input, Permutation, Token } from "../index.js";
import { chosenPermutation } from "./permutation.js";

interface Index {
    tokens: Map<string, Token>;
    groups: Map<string, Group>;
}

const indexes = new WeakMap<Permutation, Index>();

function indexOf(permutation: Permutation): Index {
    const cached = indexes.get(permutation);
    if (cached) return cached;
    const built = {
        tokens: new Map(permutation.tokens.map((each) => [each.path, each])),
        groups: new Map(permutation.groups.map((each) => [each.path, each])),
    };
    indexes.set(permutation, built);
    return built;
}

/**
 * A token by path, in the permutation an input names or in a permutation you already hold.
 * @param input Which permutation, as {@link permutation} finds it. Left out, the default
 * permutation, or the first when there is no default one.
 *
 * @example
 * token(doc, "color.brand", { theme: "dark" })?.resolved
 * // walking every permutation, look up within the one in hand
 * for (const each of doc.permutations) token(each, "color.brand")
 */
export function token(doc: Document, path: string, input?: Input): Token | undefined;
export function token(permutation: Permutation, path: string): Token | undefined;
export function token(from: Document | Permutation, path: string, input?: Input) {
    const found = within(from, input);
    return found && indexOf(found).tokens.get(path);
}

/**
 * The group at a path, in a permutation as {@link token} takes it.
 */
export function group(doc: Document, path: string, input?: Input): Group | undefined;
export function group(permutation: Permutation, path: string): Group | undefined;
export function group(from: Document | Permutation, path: string, input?: Input) {
    const found = within(from, input);
    return found && indexOf(found).groups.get(path);
}

/**
 * The tokens in a group, and in its subgroups, in file order, in a permutation as {@link token}
 * takes it. The group's own `$root` token is included; a sibling whose name merely starts the same
 * way is not. The path `""` is the top level, so every token.
 *
 * @example
 * tokensIn(doc, "space")   // space.xs, space.sm, … but not spacer.x
 */
export function tokensIn(doc: Document, path: string, input?: Input): Token[];
export function tokensIn(permutation: Permutation, path: string): Token[];
export function tokensIn(from: Document | Permutation, path: string, input?: Input) {
    const found = within(from, input);
    const prefix = `${path}.`;
    return (found?.tokens ?? []).filter((each) => path === "" || each.path.startsWith(prefix));
}

function within(from: Document | Permutation, input: Input | undefined): Permutation | undefined {
    return "permutations" in from ? chosenPermutation(from, input) : from;
}
