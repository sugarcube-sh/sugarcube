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
    Written,
    WrittenGroup,
    WrittenToken,
} from "../model.js";
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
    moved: Move[],
): Pair<T>[] {
    const byPath = new Map<string, T>();
    for (const each of earlier) {
        const path = tokenPath.applyMoves(each.path, moved);
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

export function diffGroup({ before, after }: Pair<Group>, moved: Move[]): ChangeEntry | undefined {
    const inherited = (after ?? before)?.inherited;
    const flags = inherited ? { inherited } : {};
    if (!before)
        return { kind: "group-added", path: after.path, after: writtenGroup(after), ...flags };
    if (!after) {
        return { kind: "group-removed", path: before.path, before: writtenGroup(before), ...flags };
    }
    const properties = groupDifferences(before, after, moved);
    const { path } = after;
    const snapshots = { before: writtenGroup(before), after: writtenGroup(after), ...flags };
    if (before.path !== path) {
        return { kind: "group-renamed", from: before.path, path, properties, ...snapshots };
    }
    if (properties.length === 0) return undefined;
    return { kind: "group-changed", path, properties, ...snapshots };
}

export function diffToken({ before, after }: Pair<Token>, moved: Move[]): ChangeEntry | undefined {
    const { generated, inherited } = after ?? before ?? {};
    const flags = { ...(generated && { generated }), ...(inherited && { inherited }) };
    if (!before) return { kind: "added", path: after.path, after: writtenToken(after), ...flags };
    if (!after)
        return { kind: "removed", path: before.path, before: writtenToken(before), ...flags };
    const properties = tokenDifferences(before, after, moved);
    const { path } = after;
    const snapshots = { before: writtenToken(before), after: writtenToken(after), ...flags };
    if (before.path !== path) {
        return { kind: "renamed", from: before.path, path, properties, ...snapshots };
    }
    if (properties.length === 0) return undefined;
    return { kind: "changed", path, properties, ...snapshots };
}

function writtenToken({ asWritten, description, extensions }: Token): WrittenToken {
    if (!asWritten) return {};
    return {
        value: asWritten.value,
        ...pickDefinedFields({ ...asWritten, description, extensions }),
    };
}

function writtenGroup(group: Group): WrittenGroup {
    const extended = getExtendsPath(group);
    return {
        ...pickDefinedFields(group.asWritten ?? {}),
        ...(extended !== undefined && { extends: extended }),
    };
}

function getExtendsPath(group: Group): string | undefined {
    return group.references[0]?.pointsToPath;
}

function pickDefinedFields({ type, description, deprecated, extensions }: Written): Written {
    return {
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions }),
    };
}

function tokenDifferences(before: Token, after: Token, moved: Move[]): TokenProperty[] {
    const same: Record<TokenProperty, boolean> = {
        value: hasEquivalentValue(getValueAfterMoves(before, moved), after),
        type: getDeclaredType(before) === getDeclaredType(after),
        description: before.description === after.description,
        deprecated: getDeclaredDeprecation(before) === getDeclaredDeprecation(after),
        extensions: isEqualJson(before.extensions, after.extensions),
    };
    return getChangedKeys(same);
}

function groupDifferences(before: Group, after: Group, moved: Move[]): GroupProperty[] {
    const extended = getExtendsPath(before);
    return getChangedKeys({
        ...sameWritten(before.asWritten ?? {}, after.asWritten ?? {}),
        extends:
            (extended === undefined ? undefined : tokenPath.applyMoves(extended, moved)) ===
            getExtendsPath(after),
    });
}

function sameWritten(
    before: Written,
    after: Written,
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
    return token.asWritten ? token.asWritten.type : token.type;
}

function getDeclaredDeprecation(token: Token): Written["deprecated"] {
    return token.asWritten ? token.asWritten.deprecated : token.deprecated;
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

function getValueAfterMoves(token: Token, moved: Move[]): ComparableValue {
    if (token.value !== undefined) return { value: applyMovesToValue(token.value, moved) };
    if (!token.asWritten) return token;
    let written: unknown = token.asWritten.value;
    for (const reference of token.references) {
        written = replaceAtPath(written, reference.writtenInProperty ?? [], reference.moved(moved));
    }
    return { asWritten: { value: written } };
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

function applyMovesToValue(value: unknown, moved: Move[]): unknown {
    if (isReference(value)) return applyMovesToReference(value, moved);
    if (Array.isArray(value)) return value.map((each) => applyMovesToValue(each, moved));
    if (isJsonObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, each]) => [key, applyMovesToValue(each, moved)]),
        );
    }
    return value;
}
