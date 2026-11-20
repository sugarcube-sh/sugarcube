import type { InheritedFrom } from "../../model/token.js";
import { tokenPath } from "../../path.js";
import type { Merged, MergedGroup } from "./merge.js";
import { type Settings, findSettings } from "./settings.js";

export type Inheritable = "type" | "typeBy" | "deprecated" | "deprecatedBy";

export type EffectiveSettings = Omit<Settings, "deprecated"> & { deprecated?: true | string };

export function getInheritedProperty<K extends Inheritable>(
    item: Pick<Settings, Inheritable> & { path: string },
    merged: Merged,
    property: K,
): Settings[K] {
    return item[property] ?? findInAncestors(item.path, merged, property);
}

export function findDeprecation(
    item: Pick<Settings, Inheritable> & { path: string },
    merged: Merged,
): true | string | undefined {
    return getActiveDeprecation(getInheritedProperty(item, merged, "deprecated"));
}

export function getEffectiveSettings(merged: Merged, group: MergedGroup): EffectiveSettings {
    const settings = findSettings(merged, group);
    return {
        ...settings,
        type: findGroupDefault(merged, "type", group.path),
        deprecated: getActiveDeprecation(findGroupDefault(merged, "deprecated", group.path)),
    };
}

function getActiveDeprecation(deprecated: Settings["deprecated"]): true | string | undefined {
    return deprecated === false ? undefined : deprecated;
}

function findInAncestors<K extends Inheritable>(
    path: string,
    merged: Merged,
    property: K,
): Settings[K] {
    return findGroupDefault(merged, property, tokenPath.getParent(path));
}

function findGroupDefault<K extends Inheritable>(
    merged: Merged,
    property: K,
    group: string | undefined,
): Settings[K] {
    if (group === undefined) return undefined;
    const known: Map<string, Settings[K]> = merged.inheritanceCache[property];
    const found = known.get(group);
    if (found !== undefined || known.has(group)) return found;
    const each = merged.groups.get(group);
    const applies =
        (each && findSettings(merged, each)[property]) ??
        findGroupDefault(merged, property, tokenPath.getParent(group));
    known.set(group, applies);
    return applies;
}

export function findDeprecatedFrom(
    merged: Merged,
    item: Pick<Settings, "deprecated"> & { path: string },
    inForce: Settings["deprecated"],
    extended?: string,
): InheritedFrom | undefined {
    if (inForce === undefined || item.deprecated !== undefined) return undefined;
    if (extended !== undefined) return { path: extended, via: "extends" };
    return fromGroup(findInAncestors(item.path, merged, "deprecatedBy"));
}

export function findTokenType(
    merged: Merged,
    item: Pick<Settings, "type"> & { path: string },
): { type?: Settings["type"]; typeFrom?: InheritedFrom } {
    if (item.type !== undefined) return { type: item.type };
    const typeBy = findInAncestors(item.path, merged, "typeBy");
    if (typeBy === undefined) return {};
    return { type: merged.groups.get(typeBy)?.type, typeFrom: { path: typeBy, via: "group" } };
}

export function findGroupTypeFrom(merged: Merged, group: MergedGroup): InheritedFrom | undefined {
    if (group.type !== undefined) return undefined;
    const { type, typeBy } = findSettings(merged, group);
    if (type !== undefined && typeBy !== undefined) return { path: typeBy, via: "extends" };
    return fromGroup(findInAncestors(group.path, merged, "typeBy"));
}

export function findGroupDescriptionFrom(
    merged: Merged,
    group: MergedGroup,
): InheritedFrom | undefined {
    if (group.description !== undefined) return undefined;
    const { descriptionBy } = findSettings(merged, group);
    return descriptionBy === undefined ? undefined : { path: descriptionBy, via: "extends" };
}

function fromGroup(path: string | undefined): InheritedFrom | undefined {
    return path === undefined ? undefined : { path, via: "group" };
}
