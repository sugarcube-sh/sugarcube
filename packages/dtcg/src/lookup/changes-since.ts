import type {
    Change,
    Group,
    GroupProperty,
    JsonPath,
    JsonValue,
    Move,
    Permutation,
    Permutations,
    Token,
    TokenProperty,
    OriginalProperties,
    OriginalGroup,
    OriginalToken,
} from "../model/index.js";
import { makePermutations } from "../read/make-permutations.js";
import { tokenPath } from "../path.js";
import { isJsonObject } from "../values/json.js";
import { isReference, applyMovesToReference } from "../values/references.js";
import { type ComparableValue, isEqualJson, hasEquivalentValue } from "../values/same-value.js";

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
    const inherited = (after ?? before)?.inherited;
    const flags = inherited ? { inherited } : {};
    if (!before)
        return { kind: "group-added", path: after.path, after: toOriginalGroup(after), ...flags };
    if (!after) {
        return {
            kind: "group-removed",
            path: before.path,
            before: toOriginalGroup(before),
            ...flags,
        };
    }
    const properties = groupDifferences(before, after, moves);
    const { path } = after;
    const snapshots = { before: toOriginalGroup(before), after: toOriginalGroup(after), ...flags };
    if (before.path !== path) {
        return { kind: "group-renamed", from: before.path, path, properties, ...snapshots };
    }
    if (properties.length === 0) return undefined;
    return { kind: "group-changed", path, properties, ...snapshots };
}

export function diffToken({ before, after }: Pair<Token>, moves: Move[]): ChangeEntry | undefined {
    const { generated, inherited } = after ?? before ?? {};
    const flags = { ...(generated && { generated }), ...(inherited && { inherited }) };
    if (!before)
        return { kind: "added", path: after.path, after: toOriginalToken(after), ...flags };
    if (!after)
        return { kind: "removed", path: before.path, before: toOriginalToken(before), ...flags };
    const properties = tokenDifferences(before, after, moves);
    const { path } = after;
    const snapshots = { before: toOriginalToken(before), after: toOriginalToken(after), ...flags };
    if (before.path !== path) {
        return { kind: "renamed", from: before.path, path, properties, ...snapshots };
    }
    if (properties.length === 0) return undefined;
    return { kind: "changed", path, properties, ...snapshots };
}

function toOriginalToken({ original, description, extensions }: Token): OriginalToken {
    if (!original) return {};
    return {
        value: original.value,
        ...pickDefinedFields({ ...original, description, extensions }),
    };
}

function toOriginalGroup(group: Group): OriginalGroup {
    const extended = getExtendsPath(group);
    return {
        ...pickDefinedFields(group.original ?? {}),
        ...(extended !== undefined && { extends: extended }),
    };
}

function getExtendsPath(group: Group): string | undefined {
    return group.references[0]?.pointsToPath;
}

function pickDefinedFields({
    type,
    description,
    deprecated,
    extensions,
}: OriginalProperties): OriginalProperties {
    return {
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions }),
    };
}

function tokenDifferences(before: Token, after: Token, moves: Move[]): TokenProperty[] {
    const same: Record<TokenProperty, boolean> = {
        value: hasEquivalentValue(getValueAfterMoves(before, moves), after),
        type: getDeclaredType(before) === getDeclaredType(after),
        description: before.description === after.description,
        deprecated: getDeclaredDeprecation(before) === getDeclaredDeprecation(after),
        extensions: isEqualJson(before.extensions, after.extensions),
    };
    return getChangedKeys(same);
}

function groupDifferences(before: Group, after: Group, moves: Move[]): GroupProperty[] {
    const extended = getExtendsPath(before);
    return getChangedKeys({
        ...compareOriginalProperties(before.original ?? {}, after.original ?? {}),
        extends:
            (extended === undefined ? undefined : tokenPath.applyMoves(extended, moves)) ===
            getExtendsPath(after),
    });
}

function compareOriginalProperties(
    before: OriginalProperties,
    after: OriginalProperties,
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
    return token.original ? token.original.type : token.type;
}

function getDeclaredDeprecation(token: Token): OriginalProperties["deprecated"] {
    return token.original ? token.original.deprecated : token.deprecated;
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

function getValueAfterMoves(token: Token, moves: Move[]): ComparableValue {
    if (token.value !== undefined) return { value: applyMovesToValue(token.value, moves) };
    if (!token.original) return token;
    let value: unknown = token.original.value;
    for (const reference of token.references) {
        value = replaceAtPath(value, reference.property ?? [], reference.applyMoves(moves));
    }
    return { original: { value } };
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
