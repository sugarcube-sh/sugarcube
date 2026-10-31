import type { Group, JsonPath, Place, Resolver, Source, Token, TokenType } from "../index.js";
import type { MergedGroup, MergedToken } from "./merge.js";
import { type Properties, usableType } from "./walk.js";
import { sameJson } from "../values/same-value.js";

export interface Target {
    path?: string | undefined;
    token?: Token | undefined;
    targetProperty?: JsonPath | undefined;
}

export interface MadeFrom {
    type: TokenType;
    value: unknown;
    resolved: unknown;
    invalid: true | undefined;
    deprecated: boolean | string | undefined;
    deprecatedFrom: string | undefined;
    writtenAt: readonly Place[];
}

export function sameToken(
    earlier: Token,
    written: MergedToken,
    now: MadeFrom,
    targets: readonly Target[],
): boolean {
    if (earlier.type !== now.type || earlier.deprecated !== now.deprecated) return false;
    if (earlier.deprecatedFrom !== now.deprecatedFrom) return false;
    if (!sameList(earlier.writtenAt, now.writtenAt)) return false;
    if (earlier.generated?.from !== written.generated?.from) return false;
    if (earlier.generated?.extension !== written.generated?.extension) return false;
    if (earlier.inherited?.from !== written.inherited?.from) return false;
    const { references } = earlier;
    if (references.length !== targets.length) return false;
    let intoParts = false;
    for (const [index, { path, token, targetProperty }] of targets.entries()) {
        const reference = references[index];
        if (!reference || reference.token !== token || reference.path !== path) return false;
        if (targetProperty !== undefined) intoParts = true;
    }
    const resolved = !intoParts || sameJson(earlier.resolved, now.resolved);
    if (!written.added) return resolved;
    return (
        resolved &&
        sameJson(earlier.value, now.value) &&
        earlier.description === written.description &&
        sameJson(earlier.extensions, written.extensions)
    );
}

export function sameGroup(
    earlier: Group,
    written: MergedGroup,
    applies: Properties,
    deprecatedFrom: string | undefined,
    writtenAt: readonly Place[],
    children: readonly (Token | Group)[],
    extending: Group | undefined,
): boolean {
    return (
        earlier.extends === extending &&
        earlier.type === usableType(applies.type) &&
        earlier.deprecated === applies.deprecated &&
        earlier.deprecatedFrom === deprecatedFrom &&
        earlier.inherited?.from === written.inherited?.from &&
        sameList(earlier.writtenAt, writtenAt) &&
        sameList(earlier.children, children)
    );
}

export function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
    return a.length === b.length && a.every((each, index) => each === b[index]);
}

export function sameResolver(was: Resolver, now: Resolver): boolean {
    return JSON.stringify(was) === JSON.stringify(now);
}

export function sameSource(was: Source, now: Source): boolean {
    return (
        was.file === now.file &&
        was.pointer === now.pointer &&
        was.modifier === now.modifier &&
        sameReaders(was.readBy, now.readBy) &&
        sameJson(was.sets, now.sets) &&
        sameJson(was.extensions, now.extensions)
    );
}

function sameReaders(was: Source["readBy"], now: Source["readBy"]): boolean {
    if (was === "everyone" || now === "everyone") return was === now;
    return sameList(was, now);
}

export function samePlace(a: JsonPath | undefined, b: JsonPath): boolean {
    return a === undefined ? b.length === 0 : sameList(a, b);
}
