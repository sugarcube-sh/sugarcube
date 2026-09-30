import type { TokenType } from "../index.js";
import { isTokenType } from "../values/token-types.js";
import type { Merged, MergedToken } from "./merge.js";

export function typeOf(token: MergedToken, merged: Merged): TokenType | undefined {
    const declared = token.type ?? closestGroupType(token.path, merged) ?? merged.root.type;
    return declared !== undefined && isTokenType(declared) ? declared : undefined;
}

function closestGroupType(path: string, { groups }: Merged): string | undefined {
    const segments = path.split(".");
    for (let end = segments.length - 1; end > 0; end--) {
        const type = groups.get(segments.slice(0, end).join("."))?.type;
        if (type !== undefined) return type;
    }
    return undefined;
}
