import type { TokenType } from "../index.js";
import type { Merged, MergedToken } from "./merge.js";
import type { Properties } from "./walk.js";

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

function closest<K extends "type" | "deprecated">(
    path: string,
    { root, groups }: Merged,
    property: K,
): Properties[K] {
    const segments = path.split(".");
    for (let end = segments.length - 1; end > 0; end--) {
        const found = groups.get(segments.slice(0, end).join("."))?.[property];
        if (found !== undefined) return found;
    }
    return root[property];
}
