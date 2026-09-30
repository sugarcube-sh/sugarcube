import type { TokenType } from "../index.js";
import type { Merged, MergedToken } from "./merge.js";
import type { Properties } from "./walk.js";

type Inheritable = "type" | "deprecated";

const remembered = new WeakMap<Merged, { [K in Inheritable]: Map<string, Properties[K]> }>();

export function inheritedType(
    token: MergedToken,
    merged: Merged,
): TokenType | "unusable" | undefined {
    return token.type ?? closest(token.path, merged, "type");
}

export function inheritedDeprecation(
    token: MergedToken,
    merged: Merged,
): boolean | string | undefined {
    return token.deprecated ?? closest(token.path, merged, "deprecated");
}

function closest<K extends Inheritable>(path: string, merged: Merged, property: K): Properties[K] {
    const caches = remembered.get(merged) ?? { type: new Map(), deprecated: new Map() };
    remembered.set(merged, caches);
    const cache: Map<string, Properties[K]> = caches[property];

    const fromGroup = (group: string | undefined): Properties[K] => {
        if (group === undefined) return merged.root[property];
        if (cache.has(group)) return cache.get(group);
        const found = merged.groups.get(group)?.[property] ?? fromGroup(parentOf(group));
        cache.set(group, found);
        return found;
    };
    return fromGroup(parentOf(path));
}

function parentOf(path: string): string | undefined {
    const dot = path.lastIndexOf(".");
    return dot === -1 ? undefined : path.slice(0, dot);
}
