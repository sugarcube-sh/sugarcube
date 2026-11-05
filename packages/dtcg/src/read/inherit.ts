import { tokenPath } from "../path.js";
import type { Merged, MergedGroup, MergedTopLevel } from "./merge.js";
import { type Settings, settingsOf } from "./settings.js";

export type Inheritable = "type" | "deprecated" | "deprecatedAt";

export type Applying = Omit<Settings, "deprecated"> & { deprecated?: true | string };

export function inherited<K extends Inheritable>(
    item: Pick<Settings, Inheritable> & { path: string },
    merged: Merged,
    property: K,
): Settings[K] {
    return item[property] ?? closest(item.path, merged, property);
}

export function deprecationOf(
    item: Pick<Settings, Inheritable> & { path: string },
    merged: Merged,
): true | string | undefined {
    return deprecationInForce(inherited(item, merged, "deprecated"));
}

export function applying(merged: Merged, group: MergedTopLevel | MergedGroup): Applying {
    const settings = settingsOf(merged, group);
    if (!("path" in group))
        return { ...settings, deprecated: deprecationInForce(settings.deprecated) };
    return {
        ...settings,
        type: atGroup(merged, "type", group.path),
        deprecated: deprecationInForce(atGroup(merged, "deprecated", group.path)),
    };
}

function deprecationInForce(deprecated: Settings["deprecated"]): true | string | undefined {
    return deprecated === false ? undefined : deprecated;
}

function closest<K extends Inheritable>(path: string, merged: Merged, property: K): Settings[K] {
    return atGroup(merged, property, tokenPath.getParent(path));
}

function atGroup<K extends Inheritable>(
    merged: Merged,
    property: K,
    group: string | undefined,
): Settings[K] {
    if (group === undefined) return settingsOf(merged, merged.root)[property];
    const known: Map<string, Settings[K]> = merged.inheritedAt[property];
    const found = known.get(group);
    if (found !== undefined || known.has(group)) return found;
    const each = merged.groups.get(group);
    const applies =
        (each && settingsOf(merged, each)[property]) ??
        atGroup(merged, property, tokenPath.getParent(group));
    known.set(group, applies);
    return applies;
}

export function deprecatedByGroupOf(
    merged: Merged,
    item: Pick<Settings, "deprecated"> & { path: string },
    inForce: Settings["deprecated"],
    extended?: string,
): string | undefined {
    if (inForce === undefined || item.deprecated !== undefined) return undefined;
    return extended ?? closest(item.path, merged, "deprecatedAt");
}
