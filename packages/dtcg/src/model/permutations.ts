import type { Input, Permutation } from "./permutation.js";
import { computeScope, scopeLabel } from "../lookup/permutation-label.js";
import { allModifiers, checkInput } from "../read/resolver/input.js";
import type { Resolver } from "./resolver.js";

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

interface PermutationDescription {
    scope: Scope;
    label?: string;
}

const descriptionCache = new WeakMap<readonly Permutation[], Map<string, PermutationDescription>>();

function describePermutations(
    memberSet: ReadonlySet<Permutation>,
    list: readonly Permutation[],
    all: readonly Permutation[],
): PermutationDescription {
    let known = descriptionCache.get(all);
    if (!known) {
        known = new Map();
        descriptionCache.set(all, known);
    }
    const key = all.map((each) => (memberSet.has(each) ? "1" : "0")).join("");
    let worded = known.get(key);
    if (!worded) {
        worded = { scope: computeScope(list, all) };
        known.set(key, worded);
    }
    return worded;
}

type FindByInput = (input: Input) => Permutation | undefined;

export function allPermutations(
    built: readonly Permutation[],
    resolver: Resolver | undefined,
): Permutations {
    const modifiers = allModifiers(resolver);
    return createPermutations(built, built, (input) => {
        const checked = checkInput(modifiers, input);
        if (!checked.ok) return undefined;
        return built.find((each) => sameInput(each.input, checked.input));
    });
}

export function makePermutations(given: readonly Permutation[], all: Permutations): Permutations {
    return createPermutations(given, all, all.findByInput);
}

function createPermutations(
    given: readonly Permutation[],
    all: readonly Permutation[],
    matchingAll: FindByInput,
): Permutations {
    const memberSet = new Set(given);
    const list = all.filter((each) => memberSet.has(each));
    const inputs = () => list.map(({ input }) => input);
    let others: Permutations | undefined;
    const permutations = Object.defineProperties(list, {
        inputs: { get: inputs },
        others: {
            get: () =>
                (others ??= createPermutations(
                    all.filter((each) => !memberSet.has(each)),
                    all,
                    matchingAll,
                )),
        },
        scope: { get: () => describePermutations(memberSet, list, all).scope },
        label: {
            get: () => {
                const worded = describePermutations(memberSet, list, all);
                worded.label ??= scopeLabel(worded.scope);
                return worded.label;
            },
        },
        toJSON: { value: inputs },
        select: {
            value: (test: (permutation: Permutation) => boolean) => {
                const selected = list.filter(test);
                return selected.length === list.length
                    ? permutations
                    : createPermutations(selected, all, matchingAll);
            },
        },
        findByInput: {
            value: (input: Input) => {
                const found = matchingAll(input);
                return found && memberSet.has(found) ? found : undefined;
            },
        },
    }) as unknown as Permutations;
    return permutations;
}

function sameInput(built: Input, complete: Input): boolean {
    return Object.keys(complete).every((name) => built[name] === complete[name]);
}
