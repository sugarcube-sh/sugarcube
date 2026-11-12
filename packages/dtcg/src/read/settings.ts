import type { Merged, MergedGroup } from "./merge.js";
import type { Properties } from "./walk.js";

export type Settings = Properties &
    Pick<MergedGroup, "extensionLocations"> & {
        /** The group these settings' `deprecated` comes from. */
        deprecatedBy?: string;
    };

export function findSettings(merged: Merged, group: MergedGroup): Settings {
    const known = merged.settings;
    const cached = known.get(group);
    if (cached) return cached;
    const visiting = new Set<MergedGroup>();

    const getSettings = (each: MergedGroup): Settings => {
        const found = known.get(each);
        if (found) return found;
        const own = getOwnSettings(each);
        const takes = each.inheritsFrom;
        const source = takes === undefined ? undefined : merged.groups.get(takes);
        if (!source || visiting.has(source)) return own;
        visiting.add(each);
        const from = getSettings(source);
        visiting.delete(each);
        const settings: Settings = {
            ...from,
            ...own,
            ...((from.extensions || own.extensions) && {
                extensions: { ...from.extensions, ...own.extensions },
            }),
            ...((from.extensionLocations || own.extensionLocations) && {
                extensionLocations: { ...from.extensionLocations, ...own.extensionLocations },
            }),
        };
        known.set(each, settings);
        return settings;
    };
    return getSettings(group);
}

function getOwnSettings(group: MergedGroup): Settings {
    const { type, description, deprecated, extensions, extensionLocations } = group;
    return {
        ...(type !== undefined && { type }),
        ...(description !== undefined && { description }),
        ...(deprecated !== undefined && { deprecated }),
        ...(deprecated !== undefined && { deprecatedBy: group.path }),
        ...(extensions && { extensions }),
        ...(extensionLocations && { extensionLocations }),
    };
}
