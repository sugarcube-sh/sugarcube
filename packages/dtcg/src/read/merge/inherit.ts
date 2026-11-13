import { tokenPath } from "../../path.js";
import type { Merged, MergedGroup } from "./merge.js";
import { type Settings, findSettings } from "./settings.js";

export type Inheritable = "type" | "deprecated" | "deprecatedBy";

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

export function findDeprecatingGroup(
    merged: Merged,
    item: Pick<Settings, "deprecated"> & { path: string },
    inForce: Settings["deprecated"],
    extended?: string,
): string | undefined {
    if (inForce === undefined || item.deprecated !== undefined) return undefined;
    return extended ?? findInAncestors(item.path, merged, "deprecatedBy");
}
