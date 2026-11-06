import { tokenPath } from "../path.js";
import type { Merged, MergedGroup } from "./merge.js";
import { type Settings, findSettings } from "./settings.js";

export type Inheritable = "type" | "deprecated" | "deprecatedAt";

export type Applying = Omit<Settings, "deprecated"> & { deprecated?: true | string };

export function inherited<K extends Inheritable>(
    item: Pick<Settings, Inheritable> & { path: string },
    merged: Merged,
    property: K,
): Settings[K] {
    return item[property] ?? closest(item.path, merged, property);
}

export function findDeprecation(
    item: Pick<Settings, Inheritable> & { path: string },
    merged: Merged,
): true | string | undefined {
    return deprecationInForce(inherited(item, merged, "deprecated"));
}

export function applying(merged: Merged, group: MergedGroup): Applying {
    const settings = findSettings(merged, group);
    return {
        ...settings,
        type: findGroupDefault(merged, "type", group.path),
        deprecated: deprecationInForce(findGroupDefault(merged, "deprecated", group.path)),
    };
}

function deprecationInForce(deprecated: Settings["deprecated"]): true | string | undefined {
    return deprecated === false ? undefined : deprecated;
}

function closest<K extends Inheritable>(path: string, merged: Merged, property: K): Settings[K] {
    return findGroupDefault(merged, property, tokenPath.getParent(path));
}

function findGroupDefault<K extends Inheritable>(
    merged: Merged,
    property: K,
    group: string | undefined,
): Settings[K] {
    if (group === undefined) return undefined;
    const known: Map<string, Settings[K]> = merged.inheritedAt[property];
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
    return extended ?? closest(item.path, merged, "deprecatedAt");
}
