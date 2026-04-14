import type { ResolvedTokens } from "@sugarcube-sh/core";
import type { PathIndex } from "./path-index";
import type { SlimToken, TokenDiffEntry } from "./types";

/**
 * Reduce a resolved token to the DTCG-author shape ($value + optional $extensions).
 * Returns null if the input isn't a token.
 */
function slimToken(token: ResolvedTokens[string] | undefined): SlimToken | null {
    if (!token || typeof token !== "object" || !("$value" in token)) return null;
    const $value = (token as { $value: unknown }).$value;
    const $extensions = (token as { $extensions?: Record<string, unknown> }).$extensions;
    if ($extensions && Object.keys($extensions).length > 0) {
        return { $value, $extensions };
    }
    return { $value };
}

/**
 * Compute the diff between a resolved-tokens object and the snapshot defaults.
 *
 * Groups identical changes across permutations into a single entry.
 * Diverging changes get one entry per distinct (from, to) pair.
 */
export function computeDiff(
    resolved: ResolvedTokens,
    snapshotResolved: ResolvedTokens,
    pathIndex: PathIndex
): TokenDiffEntry[] {
    type RawChange = {
        context: string;
        sourcePath: string;
        from: SlimToken;
        to: SlimToken;
        fromKey: string;
        toKey: string;
    };

    const byPath = new Map<string, RawChange[]>();
    for (const [path, indexEntries] of pathIndex.entries()) {
        for (const { context, key } of indexEntries) {
            const current = resolved[key];
            const currentSlim = slimToken(current);
            const originalSlim = slimToken(snapshotResolved[key]);
            if (!currentSlim || !originalSlim) continue;

            const fromKey = JSON.stringify(originalSlim);
            const toKey = JSON.stringify(currentSlim);
            if (fromKey === toKey) continue;

            const sourcePath =
                current && "$source" in current
                    ? (current as { $source: { sourcePath: string } }).$source.sourcePath
                    : "";

            const list = byPath.get(path);
            const change: RawChange = {
                context,
                sourcePath,
                from: originalSlim,
                to: currentSlim,
                fromKey,
                toKey,
            };
            if (list) {
                list.push(change);
            } else {
                byPath.set(path, [change]);
            }
        }
    }

    const entries: TokenDiffEntry[] = [];
    for (const [path, changes] of byPath.entries()) {
        const grouped = new Map<string, RawChange[]>();
        for (const change of changes) {
            const sig = `${change.fromKey}\u0000${change.toKey}`;
            const list = grouped.get(sig);
            if (list) {
                list.push(change);
            } else {
                grouped.set(sig, [change]);
            }
        }

        const totalIndex = pathIndex.entriesFor(path).length;
        const collapseAll = grouped.size === 1;

        for (const group of grouped.values()) {
            const first = group[0];
            if (!first) continue;
            const showContexts = !(collapseAll && group.length === totalIndex);
            entries.push({
                path,
                sourcePath: first.sourcePath,
                contexts: showContexts ? group.map((c) => c.context) : [],
                from: first.from,
                to: first.to,
            });
        }
    }

    return entries;
}
