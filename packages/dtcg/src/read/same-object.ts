import type {
    Group,
    JsonPath,
    Definition,
    Resolver,
    Source,
    Token,
    TokenType,
} from "../model/index.js";
import type { MergedGroup, MergedToken } from "./merge/merge.js";
import { type Properties, toValidType } from "./merge/walk.js";
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
    current: MergedToken,
    now: TokenBuildFields,
    targets: readonly Target[],
): boolean {
    if (earlier.type !== now.type || earlier.deprecated !== now.deprecated) return false;
    if (earlier.deprecatedByGroup !== now.deprecatedByGroup) return false;
    if (!sameList(earlier.definitions, now.definitions)) return false;
    if (earlier.generated?.from !== current.generated?.from) return false;
    if (earlier.generated?.extension !== current.generated?.extension) return false;
    if (earlier.inherited?.from !== current.inherited?.from) return false;
    const { references } = earlier;
    if (references.length !== targets.length) return false;
    for (const [index, { path, token }] of targets.entries()) {
        const reference = references[index];
        if (!reference || reference.pointsToToken !== token || reference.pointsToPath !== path)
            return false;
    }
    if (!current.generated) return true;
    return (
        isEqualJson(earlier.value, now.value) &&
        earlier.description === current.description &&
        isEqualJson(earlier.extensions, current.extensions)
    );
}

export function sameGroup(
    earlier: Group,
    current: MergedGroup,
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
        earlier.inherited?.from === current.inherited?.from &&
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
        sameContexts(was.contexts, now.contexts) &&
        isEqualJson(was.sets, now.sets) &&
        isEqualJson(was.extensions, now.extensions)
    );
}

function sameContexts(was: Source["contexts"], now: Source["contexts"]): boolean {
    if (was === "every-context" || now === "every-context") return was === now;
    return sameList(was, now);
}

export function samePropertyPath(a: JsonPath | undefined, b: JsonPath): boolean {
    return a === undefined ? b.length === 0 : sameList(a, b);
}
