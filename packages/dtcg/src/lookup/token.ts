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
 * A token by path.
 * @param input Which permutation, as {@link permutation} finds it. Left out, the default
 * permutation, or the first when there is no default one.
 *
 * @example
 * token(doc, "color.brand", { theme: "dark" })?.resolved
 */
export function token(doc: Document, path: string, input?: Input): Token | undefined {
    const found = chosenPermutation(doc, input);
    return found && indexOf(found).tokens.get(path);
}

/**
 * The group at a path.
 * @param input Which permutation, as {@link token} takes it.
 */
export function group(doc: Document, path: string, input?: Input): Group | undefined {
    const found = chosenPermutation(doc, input);
    return found && indexOf(found).groups.get(path);
}

/**
 * The tokens in a group, and in its subgroups, in file order. The group's own `$root` token is
 * included; a sibling whose name merely starts the same way is not. The path `""` is the top
 * level, so every token.
 * @param input Which permutation, as {@link token} takes it.
 *
 * @example
 * tokensIn(doc, "space")   // space.xs, space.sm, … but not spacer.x
 */
export function tokensIn(doc: Document, path: string, input?: Input): Token[] {
    const found = chosenPermutation(doc, input);
    const prefix = `${path}.`;
    return (found?.tokens ?? []).filter((each) => path === "" || each.path.startsWith(prefix));
}
