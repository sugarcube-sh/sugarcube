import type {
    Change,
    DesignTokens,
    Group,
    GroupProperty,
    JsonPath,
    JsonValue,
    Move,
    Permutation,
    Permutations,
    Token,
    TokenProperty,
    TopLevel,
    TopLevelProperty,
    Written,
    WrittenGroup,
    WrittenToken,
} from "../index.js";
import { permutationsOf } from "../read/permutations-of.js";
import { tokenPath } from "../path.js";
import { isJsonObject } from "../values/json.js";
import { isReference, movedReference } from "../values/references.js";
import { type Said, isEqualJson, saysTheSame } from "../values/same-value.js";
import { findPermutation } from "./permutation.js";

export function diffIn(
    after: DesignTokens,
    before: DesignTokens,
    options?: { moved?: Move[] },
): Change[] {
    const moved = options?.moved ?? [];
    const changes = new Changes();
    for (const now of after.permutations) {
        const was = findPermutation(before, now.input);
        if ("reason" in was) continue;
        changes.add(topLevelChange(was.topLevel, now.topLevel), now);
        for (const pair of matched(was.groups, now.groups, moved)) {
            if (pair.before !== pair.after) changes.add(groupChange(pair, moved), now);
        }
        for (const pair of matched(was.tokens, now.tokens, moved)) {
            if (pair.before !== pair.after) changes.add(tokenChange(pair, moved), now);
        }
    }
    return changes.list(after.permutations);
}

type Pair<T> =
    | { before: T; after: T }
    | { before: T; after: undefined }
    | { before: undefined; after: T };

type Found = Change extends infer C ? (C extends Change ? Omit<C, "permutations"> : never) : never;

function matched<T extends Token | Group>(
    earlier: readonly T[],
    later: readonly T[],
    moved: Move[],
): Pair<T>[] {
    const byPath = new Map<string, T>();
    for (const each of earlier) {
        const path = tokenPath.applyMoves(each.path, moved);
        if (path !== each.path || !byPath.has(path)) byPath.set(path, each);
    }
    const left = new Set(earlier);
    const pairs = later.map((after): Pair<T> => {
        const before = byPath.get(after.path);
        if (!before) return { before: undefined, after };
        left.delete(before);
        return { before, after };
    });
    return [...pairs, ...[...left].map((before) => ({ before, after: undefined }))];
}

function groupChange({ before, after }: Pair<Group>, moved: Move[]): Found | undefined {
    const inherited = (after ?? before)?.inherited;
    const marks = inherited ? { inherited } : {};
    if (!before)
        return { kind: "group-added", path: after.path, after: writtenGroup(after), ...marks };
    if (!after) {
        return { kind: "group-removed", path: before.path, before: writtenGroup(before), ...marks };
    }
    const properties = groupDifferences(before, after, moved);
    const { path } = after;
    const sides = { before: writtenGroup(before), after: writtenGroup(after), ...marks };
    if (before.path !== path) {
        return { kind: "group-renamed", from: before.path, path, properties, ...sides };
    }
    if (properties.length === 0) return undefined;
    return { kind: "group-changed", path, properties, ...sides };
}

function tokenChange({ before, after }: Pair<Token>, moved: Move[]): Found | undefined {
    const { generated, inherited } = after ?? before ?? {};
    const marks = { ...(generated && { generated }), ...(inherited && { inherited }) };
    if (!before) return { kind: "added", path: after.path, after: writtenToken(after), ...marks };
    if (!after)
        return { kind: "removed", path: before.path, before: writtenToken(before), ...marks };
    const properties = tokenDifferences(before, after, moved);
    const { path } = after;
    const sides = { before: writtenToken(before), after: writtenToken(after), ...marks };
    if (before.path !== path) {
        return { kind: "renamed", from: before.path, path, properties, ...sides };
    }
    if (properties.length === 0) return undefined;
    return { kind: "changed", path, properties, ...sides };
}

function writtenToken({ asWritten, description, extensions }: Token): WrittenToken {
    if (!asWritten) return {};
    return { value: asWritten.value, ...writtenOf({ ...asWritten, description, extensions }) };
}

function writtenGroup(group: Group): WrittenGroup {
    const extended = extendedPath(group);
    return { ...writtenOf(group.asWritten ?? {}), ...(extended && { extends: extended }) };
}

function extendedPath(group: Group): string | undefined {
    return group.references[0]?.pointsToPath;
}

function writtenOf({ type, description, deprecated, extensions }: Written): Written {
    return {
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(extensions && { extensions }),
    };
}

function tokenDifferences(before: Token, after: Token, moved: Move[]): TokenProperty[] {
    const same: Record<TokenProperty, boolean> = {
        value: saysTheSame(saidAfterMoves(before, moved), after),
        type: saidType(before) === saidType(after),
        description: before.description === after.description,
        deprecated: saidDeprecation(before) === saidDeprecation(after),
        extensions: isEqualJson(before.extensions, after.extensions),
    };
    return differing(same);
}

function groupDifferences(before: Group, after: Group, moved: Move[]): GroupProperty[] {
    const extended = extendedPath(before);
    return differing({
        ...sameWritten(before.asWritten ?? {}, after.asWritten ?? {}),
        extends: (extended && tokenPath.applyMoves(extended, moved)) === extendedPath(after),
    });
}

function topLevelChange(before: TopLevel, after: TopLevel): Found | undefined {
    const properties = differing(sameWritten(before, after));
    if (properties.length === 0) return undefined;
    return {
        kind: "top-level-changed",
        properties,
        before: writtenOf(before),
        after: writtenOf(after),
    };
}

function sameWritten(before: Written, after: Written): Record<TopLevelProperty, boolean> {
    return {
        type: before.type === after.type,
        description: before.description === after.description,
        deprecated: before.deprecated === after.deprecated,
        extensions: isEqualJson(before.extensions, after.extensions),
    };
}

function differing<P extends string>(same: Record<P, boolean>): P[] {
    return (Object.keys(same) as P[]).filter((property) => !same[property]);
}

function saidType(token: Token): string | undefined {
    return token.asWritten ? token.asWritten.type : token.type;
}

function saidDeprecation(token: Token): Token["deprecated"] {
    return token.asWritten ? token.asWritten.deprecated : token.deprecated;
}

class Changes {
    readonly #found: { change: Found; permutations: Permutation[] }[] = [];
    readonly #byKey = new Map<string, { change: Found; permutations: Permutation[] }[]>();

    add(change: Found | undefined, permutation: Permutation): void {
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
        this.#found.push(entry);
    }

    list(all: Permutations): Change[] {
        return this.#found.map(
            ({ change, permutations }) =>
                ({ ...change, permutations: permutationsOf(permutations, all) }) as Change,
        );
    }
}

function saidAfterMoves(token: Token, moved: Move[]): Said {
    if (token.value !== undefined) return { value: forwarded(token.value, moved) };
    if (!token.asWritten) return token;
    let written: unknown = token.asWritten.value;
    for (const reference of token.references) {
        written = replacedAt(written, reference.writtenInProperty ?? [], reference.moved(moved));
    }
    return { asWritten: { value: written } };
}

function replacedAt(value: unknown, [step, ...rest]: JsonPath, by: JsonValue): unknown {
    if (step === undefined) return by;
    if (Array.isArray(value)) {
        return value.map((each, index) => (index === step ? replacedAt(each, rest, by) : each));
    }
    if (!isJsonObject(value)) return value;
    return { ...value, [step]: replacedAt(value[step], rest, by) };
}

function forwarded(value: unknown, moved: Move[]): unknown {
    if (isReference(value)) return movedReference(value, moved);
    if (Array.isArray(value)) return value.map((each) => forwarded(each, moved));
    if (isJsonObject(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, each]) => [key, forwarded(each, moved)]),
        );
    }
    return value;
}
