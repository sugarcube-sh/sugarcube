import type { Input, Permutation, ResolverContext, Scope } from "../index.js";

/**
 * An input written out for people: each modifier and its context, in the order the input lists
 * them, such as an input that names no permutation the read built.
 *
 * @example
 * permutationLabel({ mode: "dark", density: "comfy" }) // "mode: dark, density: comfy"
 */
export function permutationLabel(input: Input): string {
    return Object.entries(input)
        .map(([modifier, context]) => `${modifier}: ${context}`)
        .join(", ");
}

export function ownLabel(contexts: ResolverContext[]): string {
    return partText(Object.fromEntries(contexts.map((each) => [each.modifier.name, [each.name]])));
}

type Part = Record<string, string[]>;

export function scopeOf(set: readonly Permutation[], all: readonly Permutation[]): Scope {
    const [first] = set;
    if (!first) return [];
    const modifiers = first.contexts.map(({ modifier }) => modifier);
    const exact = (part: Part) => {
        const combinations = modifiers.reduce(
            (count, { name, contexts }) => count * (part[name]?.length ?? contexts.length),
            1,
        );
        return set.filter((perm) => matches(part, perm)).length === combinations;
    };
    const pinned = set.map((perm): Part => {
        const part: Part = {};
        for (const { modifier, name } of perm.contexts) part[modifier.name] = [name];
        return part;
    });
    const widened = merged(merged(pinned).map((part) => widen(part, exact)));
    return uncovered(widened, all).map((part) => inWrittenOrder(part, first.contexts));
}

function inWrittenOrder(part: Part, contexts: readonly ResolverContext[]): Part {
    const ordered: Part = {};
    for (const { modifier } of contexts) {
        const names = part[modifier.name];
        if (!names) continue;
        ordered[modifier.name] = modifier.contexts
            .map(({ name }) => name)
            .filter((name) => names.includes(name));
    }
    return ordered;
}

export function scopeLabel(scope: Scope): string {
    if (scope.length === 0) return "nowhere";
    return scope
        .map((part) => {
            if (Object.keys(part).length === 0) return "everywhere";
            return partText(part);
        })
        .join("; ");
}

function partText(part: Scope[number]): string {
    return Object.entries(part)
        .map(([modifier, contexts]) => `${modifier}: ${contexts.join(", ")}`)
        .join(", ");
}

function matches(part: Scope[number], perm: Permutation): boolean {
    return perm.contexts.every(({ modifier, name }) => part[modifier.name]?.includes(name) ?? true);
}

function merged(parts: Part[]): Part[] {
    const result = [...parts];
    for (let i = 0; i < result.length; i++) {
        for (let j = i + 1; j < result.length; j++) {
            const joined = joinedOn(result[i], result[j]);
            if (!joined) continue;
            result[i] = joined;
            result.splice(j, 1);
            i = -1;
            break;
        }
    }
    return result;
}

function joinedOn(one: Part | undefined, other: Part | undefined): Part | undefined {
    if (!one || !other) return undefined;
    const keys = Object.keys(one);
    if (!sameNames(keys, Object.keys(other))) return undefined;
    const differing = keys.filter((key) => !sameNames(one[key] ?? [], other[key] ?? []));
    const [key] = differing;
    if (key === undefined || differing.length > 1) return undefined;
    return { ...one, [key]: [...new Set([...(one[key] ?? []), ...(other[key] ?? [])])] };
}

function sameNames(one: readonly string[], other: readonly string[]): boolean {
    return one.length === other.length && one.every((name) => other.includes(name));
}

function uncovered(parts: Part[], all: readonly Permutation[]): Part[] {
    const kept = [...parts];
    for (let i = kept.length - 1; i >= 0; i--) {
        const part = kept[i];
        const others = kept.filter((_, index) => index !== i);
        const covered = all
            .filter((perm) => part && matches(part, perm))
            .every((perm) => others.some((other) => matches(other, perm)));
        if (covered) kept.splice(i, 1);
    }
    return kept;
}

function widen(part: Part, exact: (part: Part) => boolean): Part {
    let widest = part;
    for (const key of Object.keys(part)) {
        const { [key]: _, ...without } = widest;
        if (exact(without)) widest = without;
    }
    return widest;
}
