import { parentOf } from "../path.js";
import type { Merged, MergedGroup, MergedTopLevel } from "./merge.js";
import { type Settings, settingsOf } from "./settings.js";

export type Inheritable = "type" | "deprecated" | "deprecatedAt";

export function inherited<K extends Inheritable>(
    item: Pick<Settings, Inheritable> & { path: string },
    merged: Merged,
    property: K,
): Settings[K] {
    return item[property] ?? closest(item.path, merged, property);
}

export function applying(merged: Merged, group: MergedTopLevel | MergedGroup): Settings {
    const settings = settingsOf(merged, group);
    if (!("path" in group)) return settings;
    return {
        ...settings,
        type: atGroup(merged, "type", group.path),
        deprecated: atGroup(merged, "deprecated", group.path),
    };
}

function closest<K extends Inheritable>(path: string, merged: Merged, property: K): Settings[K] {
    return atGroup(merged, property, parentOf(path));
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
        (each && settingsOf(merged, each)[property]) ?? atGroup(merged, property, parentOf(group));
    known.set(group, applies);
    return applies;
}

export function deprecatedFrom(
    merged: Merged,
    item: Pick<Settings, "deprecated"> & { path: string },
    inForce: Settings["deprecated"],
    extended?: string,
): string | undefined {
    if (inForce === undefined || item.deprecated !== undefined) return undefined;
    return extended ?? closest(item.path, merged, "deprecatedAt");
}
