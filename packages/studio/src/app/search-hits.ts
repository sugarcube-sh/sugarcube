import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import { cssColorFor } from "../tokens/color-value";
import { cssLengthFor } from "../tokens/dimension";
import type { PathIndex } from "../tokens/path-index";

export type Hit = {
    path: string;
    swatch: string | undefined;
    value: string | undefined;
};

export type SearchResult = {
    hits: Hit[];
    capped: boolean;
};

export const MAX_RESULTS = 40;

export function searchHits(
    index: PathIndex,
    resolved: ResolvedTokens,
    context: string,
    query: string,
    max = MAX_RESULTS,
): SearchResult {
    const needle = query.trim().toLowerCase();
    if (!needle) return { hits: [], capped: false };

    const read = (path: string) => {
        const handle = index.handleAt(path);
        return handle === undefined ? undefined : index.readValue(resolved, handle, context);
    };
    const hits: Hit[] = [];

    for (const [handle] of index.entries()) {
        const path = index.pathOf(handle);
        if (path === undefined || !path.toLowerCase().includes(needle)) continue;
        if (hits.length === max) return { hits, capped: true };

        const token = index.readToken(resolved, handle, context);
        const colour = token?.$type === "color" ? cssColorFor(path, read) : undefined;
        hits.push({ path, swatch: colour, value: colour ?? cssLengthFor(path, read) });
    }

    return { hits, capped: false };
}
