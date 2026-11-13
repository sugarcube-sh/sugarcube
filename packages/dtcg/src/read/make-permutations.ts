import type { Input, Permutation, Permutations, Resolver, Scope } from "../model.js";
import { scopeLabel, computeScope } from "../lookup/permutation-label.js";
import { checkInput, allModifiers } from "./resolver/input.js";

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
