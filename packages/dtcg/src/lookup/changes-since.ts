import type { Change, GroupProperty, Move, TokenProperty } from "../model/change.js";
import type { LocalGroup, LocalProperties } from "../model/definition.js";
import type { Group } from "../model/group.js";
import type { JsonPath } from "../model/location.js";
import type { JsonValue } from "../model/json.js";
import type { Permutation } from "../model/permutation.js";
import { type Permutations, makePermutations } from "../model/permutations.js";
import type { Token } from "../model/token.js";
import { tokenPath } from "../path.js";
import { isJsonObject } from "../values/json.js";
import { isReference, applyMovesToReference } from "../values/references.js";
import { isEqualJson, hasEquivalentValue } from "../values/same-value.js";

type Pair<T> =
    | { before: T; after: T }
    | { before: T; after: undefined }
    | { before: undefined; after: T };

type ChangeEntry = Change extends infer C
    ? C extends Change
        ? Omit<C, "permutations">
        : never
    : never;

export function pairByPath<T extends Token | Group>(
    earlier: readonly T[],
    later: readonly T[],
    moves: Move[],
): Pair<T>[] {
    const byPath = new Map<string, T>();
    for (const each of earlier) {
        const path = tokenPath.applyMoves(each.path, moves);
        if (path !== each.path || !byPath.has(path)) byPath.set(path, each);
    }
    const unmatched = new Set(earlier);
    const pairs = later.map((after): Pair<T> => {
        const before = byPath.get(after.path);
        if (!before) return { before: undefined, after };
        unmatched.delete(before);
        return { before, after };
    });
    return [...pairs, ...[...unmatched].map((before) => ({ before, after: undefined }))];
}

export function diffGroup({ before, after }: Pair<Group>, moves: Move[]): ChangeEntry | undefined {
    const extendedFrom = (after ?? before)?.extendedFrom;
    const flags = extendedFrom ? { extendedFrom } : {};
    if (!before)
        return { kind: "group-added", path: after.path, after: after.local ?? {}, ...flags };
    if (!after) {
        return { kind: "group-removed", path: before.path, before: before.local ?? {}, ...flags };
    }
    const properties = groupDifferences(before, after, moves);
    const { path } = after;
    const snapshots = { before: before.local ?? {}, after: after.local ?? {}, ...flags };
    if (before.path !== path) {
        return { kind: "group-renamed", from: before.path, path, properties, ...snapshots };
    }
    if (properties.length === 0) return undefined;
    return { kind: "group-changed", path, properties, ...snapshots };
}

export function diffToken({ before, after }: Pair<Token>, moves: Move[]): ChangeEntry | undefined {
    const { generatedFrom, extendedFrom } = after ?? before ?? {};
    const flags = {
        ...(generatedFrom && { generatedFrom }),
        ...(extendedFrom && { extendedFrom }),
    };
    if (!before)
        return { kind: "added", path: after.path, after: after.winningDefinition.local, ...flags };
    if (!after)
        return {
            kind: "removed",
            path: before.path,
            before: before.winningDefinition.local,
            ...flags,
        };
    const properties = tokenDifferences(before, after, moves);
    const { path } = after;
    const snapshots = {
        before: before.winningDefinition.local,
        after: after.winningDefinition.local,
        ...flags,
    };
    if (before.path !== path) {
        return { kind: "renamed", from: before.path, path, properties, ...snapshots };
    }
    if (properties.length === 0) return undefined;
    return { kind: "changed", path, properties, ...snapshots };
}

function tokenDifferences(before: Token, after: Token, moves: Move[]): TokenProperty[] {
    const same: Record<TokenProperty, boolean> = {
        value: isSameValue(before, after, moves),
        type: getDeclaredType(before) === getDeclaredType(after),
        description: before.description === after.description,
        deprecated: getDeclaredDeprecation(before) === getDeclaredDeprecation(after),
        extensions: isEqualJson(before.extensions, after.extensions),
    };
    return getChangedKeys(same);
}

function groupDifferences(before: Group, after: Group, moves: Move[]): GroupProperty[] {
    const earlier: LocalGroup = before.local ?? {};
    const later: LocalGroup = after.local ?? {};
    const extended = earlier.extends;
    return getChangedKeys({
        ...compareLocalProperties(earlier, later),
        extends:
            (extended === undefined ? undefined : tokenPath.applyMoves(extended, moves)) ===
            later.extends,
    });
}

function compareLocalProperties(
    before: LocalProperties,
    after: LocalProperties,
): Record<Exclude<GroupProperty, "extends">, boolean> {
    return {
        type: before.type === after.type,
        description: before.description === after.description,
        deprecated: before.deprecated === after.deprecated,
        extensions: isEqualJson(before.extensions, after.extensions),
    };
}

function getChangedKeys<P extends string>(same: Record<P, boolean>): P[] {
    return (Object.keys(same) as P[]).filter((property) => !same[property]);
}

function getDeclaredType(token: Token): string | undefined {
    return token.generatedFrom ? token.type : token.winningDefinition.local.type;
}

function getDeclaredDeprecation(token: Token): LocalProperties["deprecated"] {
    return token.generatedFrom ? token.deprecated : token.winningDefinition.local.deprecated;
}

export class Changes {
    readonly #entries: { change: ChangeEntry; permutations: Permutation[] }[] = [];
    readonly #byKey = new Map<string, { change: ChangeEntry; permutations: Permutation[] }[]>();

    add(change: ChangeEntry | undefined, permutation: Permutation): void {
        if (!change) return;
        const key = `${change.kind} ${change.path ?? ""} ${"from" in change ? change.from : ""}`;
        const earlier = this.#byKey.get(key) ?? [];
        const same = earlier.find((each) => isEqualJson(each.change, change));
        if (same) {
            same.permutations.push(permutation);
            return;
        }
        const entry = { change, permutations: [permutation] };
        earlier.push(entry);
        this.#byKey.set(key, earlier);
        this.#entries.push(entry);
    }

    list(all: Permutations): Change[] {
        return this.#entries.map(
            ({ change, permutations }) =>
                ({ ...change, permutations: makePermutations(permutations, all) }) as Change,
        );
    }
}

function isSameValue(before: Token, after: Token, moves: Move[]): boolean {
    if (before.parsedValue === undefined || after.parsedValue === undefined) {
        return (
            before.parsedValue === after.parsedValue &&
            isEqualJson(
                getWrittenValueAfterMoves(before, moves),
                after.winningDefinition.local.value,
            )
        );
    }
    return hasEquivalentValue(applyMovesToValue(before.parsedValue, moves), after.parsedValue);
}

function getWrittenValueAfterMoves(token: Token, moves: Move[]): unknown {
    let value: unknown = token.winningDefinition.local.value;
    for (const reference of token.references) {
        value = replaceAtPath(value, reference.ownerProperty ?? [], reference.applyMoves(moves));
    }
    return value;
}

function replaceAtPath(value: unknown, [step, ...rest]: JsonPath, replacement: JsonValue): unknown {
    if (step === undefined) return replacement;
    if (Array.isArray(value)) {
        return value.map((each, index) =>
            index === step ? replaceAtPath(each, rest, replacement) : each,
        );
    }
    if (!isJsonObject(value)) return value;
    return { ...value, [step]: replaceAtPath(value[step], rest, replacement) };
}

function applyMovesToValue(value: unknown, moves: Move[]): unknown {
    if (isReference(value)) return applyMovesToReference(value, moves);
    if (Array.isArray(value)) return value.map((each) => applyMovesToValue(each, moves));
    if (isJsonObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, each]) => [key, applyMovesToValue(each, moves)]),
        );
    }
    return value;
}
