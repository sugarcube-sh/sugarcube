import type { Merged, MergedGroup, MergedTopLevel } from "./merge.js";
import type { Properties } from "./walk.js";

export type Settings = Properties &
    Pick<MergedTopLevel, "extensionsAt"> & {
        /** The group writing the `deprecated` these settings hold. */
        deprecatedAt?: string;
    };

export function settingsOf(merged: Merged, group: MergedTopLevel | MergedGroup): Settings {
    const known = merged.settings;
    const kept = known.get(group);
    if (kept) return kept;
    const visiting = new Set<MergedTopLevel>();

    const of = (each: MergedTopLevel | MergedGroup): Settings => {
        const found = known.get(each);
        if (found) return found;
        const own = written(each);
        const takes = "takesFrom" in each ? each.takesFrom : undefined;
        const source = takes === undefined ? undefined : merged.groups.get(takes);
        if (!source || visiting.has(source)) return own;
        visiting.add(each);
        const from = of(source);
        visiting.delete(each);
        const settings: Settings = {
            ...from,
            ...own,
            ...((from.extensions || own.extensions) && {
                extensions: { ...from.extensions, ...own.extensions },
            }),
            ...((from.extensionsAt || own.extensionsAt) && {
                extensionsAt: { ...from.extensionsAt, ...own.extensionsAt },
            }),
        };
        known.set(each, settings);
        return settings;
    };
    return of(group);
}

function written(group: MergedTopLevel | MergedGroup): Settings {
    const { type, description, deprecated, extensions, extensionsAt } = group;
    return {
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(deprecated !== undefined && "path" in group && { deprecatedAt: group.path }),
        ...(extensions && { extensions }),
        ...(extensionsAt && { extensionsAt }),
    };
}
