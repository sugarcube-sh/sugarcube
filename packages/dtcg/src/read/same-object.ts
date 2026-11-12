import type { Group, JsonPath, Definition, Resolver, Source, Token, TokenType } from "../model.js";
import type { MergedGroup, MergedToken } from "./merge.js";
import { type Properties, toValidType } from "./walk.js";
import { isEqualJson } from "../values/same-value.js";

export interface Target {
    path?: string | undefined;
    token?: Token | undefined;
    pointsToProperty?: JsonPath | undefined;
}

export interface TokenBuildFields {
    type: TokenType;
    value: unknown;
    resolved: unknown;
    invalid: true | undefined;
    deprecated: boolean | string | undefined;
    deprecatedByGroup: string | undefined;
    definitions: readonly Definition[];
}

export function sameToken(
    earlier: Token,
    written: MergedToken,
    now: TokenBuildFields,
    targets: readonly Target[],
): boolean {
    if (earlier.type !== now.type || earlier.deprecated !== now.deprecated) return false;
    if (earlier.deprecatedByGroup !== now.deprecatedByGroup) return false;
    if (!sameList(earlier.definitions, now.definitions)) return false;
    if (earlier.generated?.from !== written.generated?.from) return false;
    if (earlier.generated?.extension !== written.generated?.extension) return false;
    if (earlier.inherited?.from !== written.inherited?.from) return false;
    const { references } = earlier;
    if (references.length !== targets.length) return false;
    for (const [index, { path, token }] of targets.entries()) {
        const reference = references[index];
        if (!reference || reference.pointsToToken !== token || reference.pointsToPath !== path)
            return false;
    }
    if (!written.isGenerated) return true;
    return (
        isEqualJson(earlier.value, now.value) &&
        earlier.description === written.description &&
        isEqualJson(earlier.extensions, written.extensions)
    );
}

export function sameGroup(
    earlier: Group,
    written: MergedGroup,
    applies: Properties,
    deprecatedByGroup: string | undefined,
    definitions: readonly Definition[],
    children: readonly (Token | Group)[],
    extending: Group | undefined,
): boolean {
    return (
        earlier.extends === extending &&
        earlier.type === toValidType(applies.type) &&
        earlier.deprecated === applies.deprecated &&
        earlier.deprecatedByGroup === deprecatedByGroup &&
        earlier.inherited?.from === written.inherited?.from &&
        sameList(earlier.definitions, definitions) &&
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
        sameContexts(was.readBy, now.readBy) &&
        isEqualJson(was.sets, now.sets) &&
        isEqualJson(was.extensions, now.extensions)
    );
}

function sameContexts(was: Source["readBy"], now: Source["readBy"]): boolean {
    if (was === "every-context" || now === "every-context") return was === now;
    return sameList(was, now);
}

export function samePropertyPath(a: JsonPath | undefined, b: JsonPath): boolean {
    return a === undefined ? b.length === 0 : sameList(a, b);
}
