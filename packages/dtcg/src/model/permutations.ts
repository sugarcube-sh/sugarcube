import type { Input, Permutation } from "./permutation.js";

/**
 * Which permutations are in a {@link Permutations}, by their contexts.
 *
 * A permutation is in it if any part matches. A modifier a part leaves out can be any of its
 * contexts, unlike in an {@link Input}. `[{}]` is every combination, and `[]` is none.
 *
 * @example
 * // Only dark
 * tokens.permutations.select((permutation) => permutation === dark).scope
 * // => [{ mode: ["dark"] }]
 */
export type Scope = readonly Readonly<Record<string, readonly string[]>>[];

/**
 * Some of the design tokens' permutations, in order.
 *
 * It's an array, with `inputs`, `scope` and a `label` added.
 *
 * @example
 * // Where dark.json's color.primary applies
 * tokens.getDefinitions("color.primary")[1]!.permutations.label
 * // => "mode: dark"
 */
export interface Permutations extends ReadonlyArray<Permutation> {
    /** Each permutation's input, in the same order. */
    readonly inputs: readonly Input[];
    /** Which permutations it holds, by their contexts, as a {@link Scope}. */
    readonly scope: Scope;
    /**
     * The permutations the read built that aren't in this one.
     *
     * @example
     * // The permutations that aren't dark
     * tokens.permutations.select((permutation) => permutation === dark).others.map((p) => p.label)
     * // => ["mode: light"]
     */
    readonly others: Permutations;
    /**
     * A name for the permutations in it, such as `"mode: dark"`.
     *
     * All of them is `"every permutation"`, and none is `"no permutation"`.
     *
     * @example
     * // Both light and dark
     * tokens.permutations.label
     * // => "every permutation"
     */
    readonly label: string;
    /**
     * Picks the permutations that pass `test`, and keeps the label.
     *
     * `filter` returns a plain array instead.
     *
     * @param test - Asked of each permutation, such as `(permutation) => permutation !== light`.
     *
     * @example
     * // Every permutation but light
     * tokens.permutations.select((permutation) => permutation !== light).label
     * // => "mode: dark"
     */
    select(test: (permutation: Permutation) => boolean): Permutations;
    /**
     * Finds the permutation in this array that an input names.
     *
     * It returns `undefined` if there's none. To find out why, use
     * {@link DesignTokens.getPermutation}, which throws a {@link PermutationError}.
     *
     * @param input - The input, such as `{ mode: "dark" }`.
     *
     * @example
     * // dark, found by its input
     * tokens.permutations.findByInput({ mode: "dark" })?.label
     * // => "mode: dark"
     */
    findByInput(input: Input): Permutation | undefined;
}
