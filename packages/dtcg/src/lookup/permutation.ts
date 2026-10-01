import type { Document, Input, Permutation } from "../index.js";
import { findByName } from "../read/permutations.js";

/**
 * The permutation for an input. Modifiers left out take their default, and names match whatever
 * their case, as the resolver spec asks.
 *
 * @returns `undefined` when the input names a modifier or context the resolver does not declare,
 * leaves out a modifier that has no default, or asks for a permutation the read did not build.
 *
 * @example
 * permutation(doc, { theme: "dark" })   // the dark theme, every other modifier at its default
 */
export function permutation(doc: Document, input: Input = {}): Permutation | undefined {
    const full = fullInput(doc, input);
    if (full === undefined) return undefined;
    const names = Object.keys(doc.modifiers);
    return doc.permutations.find((each) => names.every((name) => each.input[name] === full[name]));
}

/**
 * The permutation in which every modifier is at its default.
 *
 * @returns `undefined` when a modifier has no default, or the read did not build it.
 */
export function defaultPermutation(doc: Document): Permutation | undefined {
    return permutation(doc);
}

export function chosenPermutation(
    doc: Document,
    input: Input | undefined,
): Permutation | undefined {
    if (input !== undefined) return permutation(doc, input);
    return defaultPermutation(doc) ?? doc.permutations[0];
}

function fullInput(doc: Document, input: Input): Input | undefined {
    const names = Object.keys(doc.modifiers);
    const full: Input = {};
    for (const [key, value] of Object.entries(input)) {
        const name = findByName(names, key, (each) => each);
        const contexts = name === undefined ? [] : (doc.modifiers[name]?.contexts ?? []);
        const context = findByName(contexts, value, (each) => each);
        if (name === undefined || context === undefined) return undefined;
        full[name] = context;
    }
    for (const name of names) {
        const context = full[name] ?? doc.modifiers[name]?.default;
        if (context === undefined) return undefined;
        full[name] = context;
    }
    return full;
}
