import type { Input, Permutation, Permutations, Resolver, Scope } from "../index.js";
import { scopeLabel, scopeOf } from "../lookup/permutation-label.js";
import { checkedInput, modifiersIn } from "./input.js";

interface Worded {
    scope: Scope;
    label?: string;
}

const wordedIn = new WeakMap<readonly Permutation[], Map<string, Worded>>();

function wordedFor(
    held: ReadonlySet<Permutation>,
    list: readonly Permutation[],
    all: readonly Permutation[],
): Worded {
    let known = wordedIn.get(all);
    if (!known) {
        known = new Map();
        wordedIn.set(all, known);
    }
    const key = all.map((each) => (held.has(each) ? "1" : "0")).join("");
    let worded = known.get(key);
    if (!worded) {
        worded = { scope: scopeOf(list, all) };
        known.set(key, worded);
    }
    return worded;
}

type Matching = (input: Input) => Permutation | undefined;

export function allPermutations(
    built: readonly Permutation[],
    resolver: Resolver | undefined,
): Permutations {
    const modifiers = modifiersIn(resolver);
    return listed(built, built, (input) => {
        const checked = checkedInput(modifiers, input);
        if (!checked.ok) return undefined;
        return built.find((each) => sameInput(each.input, checked.input));
    });
}

export function permutationsOf(given: readonly Permutation[], all: Permutations): Permutations {
    return listed(given, all, all.matching);
}

function listed(
    given: readonly Permutation[],
    all: readonly Permutation[],
    matchingAll: Matching,
): Permutations {
    const held = new Set(given);
    const list = all.filter((each) => held.has(each));
    const inputs = () => list.map(({ input }) => input);
    let others: Permutations | undefined;
    const permutations = Object.defineProperties(list, {
        inputs: { get: inputs },
        others: {
            get: () =>
                (others ??= listed(
                    all.filter((each) => !held.has(each)),
                    all,
                    matchingAll,
                )),
        },
        scope: { get: () => wordedFor(held, list, all).scope },
        label: {
            get: () => {
                const worded = wordedFor(held, list, all);
                worded.label ??= scopeLabel(worded.scope);
                return worded.label;
            },
        },
        toJSON: { value: inputs },
        where: {
            value: (test: (permutation: Permutation) => boolean) => {
                const kept = list.filter(test);
                return kept.length === list.length ? permutations : listed(kept, all, matchingAll);
            },
        },
        matching: {
            value: (input: Input) => {
                const found = matchingAll(input);
                return found && held.has(found) ? found : undefined;
            },
        },
    }) as unknown as Permutations;
    return permutations;
}

function sameInput(built: Input, complete: Input): boolean {
    return Object.keys(complete).every((name) => built[name] === complete[name]);
}
