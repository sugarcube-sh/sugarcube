import type { Group } from "../../model/group.js";
import { sameList } from "../../model/location.js";
import type { Definition } from "../../model/definition.js";
import type { Target } from "../../model/reference.js";
import type { Resolver } from "../../model/resolver.js";
import type { Source } from "../../model/source.js";
import type { InheritedFrom, Token } from "../../model/token.js";
import type { TokenType } from "../../model/value.js";
import type { EffectiveSettings } from "../merge/inherit.js";
import type { MergedGroup, MergedToken } from "../merge/merge.js";
import { toValidType } from "../merge/walk.js";
import { isEqualJson } from "../../values/same-value.js";

export interface TokenBuildFields {
    type: TokenType;
    parsedValue: unknown;
    resolvedValue: unknown;
    invalid: true | undefined;
    typeFrom: InheritedFrom | undefined;
    deprecated: boolean | string | undefined;
    deprecatedFrom: InheritedFrom | undefined;
    definitions: readonly Definition[];
}

export interface GroupBuildFields {
    settings: EffectiveSettings;
    typeFrom: InheritedFrom | undefined;
    descriptionFrom: InheritedFrom | undefined;
    deprecatedFrom: InheritedFrom | undefined;
    definitions: readonly Definition[];
    extensionDefinitions: Readonly<Record<string, Definition>>;
    children: (Token | Group)[];
    extending: Group | undefined;
}

export function sameToken(
    earlier: Token,
    current: MergedToken,
    now: TokenBuildFields,
    targets: readonly Target[],
): boolean {
    if (earlier.type !== now.type || earlier.deprecated !== now.deprecated) return false;
    if (!sameInheritedFrom(earlier.typeFrom, now.typeFrom)) return false;
    if (!sameInheritedFrom(earlier.deprecatedFrom, now.deprecatedFrom)) return false;
    if (!sameList(earlier.definitions, now.definitions)) return false;
    if (earlier.generatedFrom?.path !== current.generatedFrom?.path) return false;
    if (earlier.generatedFrom?.extension !== current.generatedFrom?.extension) return false;
    if (earlier.extendedFrom?.path !== current.extendedFrom?.path) return false;
    const { references } = earlier;
    if (references.length !== targets.length) return false;
    for (const [index, { path, token }] of targets.entries()) {
        const reference = references[index];
        if (!reference || reference.pointsToToken !== token || reference.pointsToPath !== path)
            return false;
    }
    if (!current.generatedFrom) return true;
    return (
        isEqualJson(earlier.parsedValue, now.parsedValue) &&
        earlier.description === current.description &&
        isEqualJson(earlier.extensions, current.extensions)
    );
}

export function sameGroup(
    earlier: Group,
    current: MergedGroup,
    { settings, typeFrom, descriptionFrom, deprecatedFrom, ...fields }: GroupBuildFields,
): boolean {
    return (
        earlier.extends === fields.extending &&
        earlier.type === toValidType(settings.type) &&
        earlier.deprecated === settings.deprecated &&
        sameInheritedFrom(earlier.typeFrom, typeFrom) &&
        sameInheritedFrom(earlier.descriptionFrom, descriptionFrom) &&
        sameInheritedFrom(earlier.deprecatedFrom, deprecatedFrom) &&
        earlier.extendedFrom?.path === current.extendedFrom?.path &&
        sameExtensionDefinitions(earlier.extensionDefinitions, fields.extensionDefinitions) &&
        sameList(earlier.definitions, fields.definitions) &&
        sameList(earlier.children, fields.children)
    );
}

function sameInheritedFrom(a: InheritedFrom | undefined, b: InheritedFrom | undefined): boolean {
    return a?.path === b?.path && a?.via === b?.via;
}

function sameExtensionDefinitions(
    a: Readonly<Record<string, Definition>>,
    b: Readonly<Record<string, Definition>>,
): boolean {
    if (a === b) return true;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
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
    if (was === undefined || now === undefined) return was === now;
    return sameList(was, now);
}
