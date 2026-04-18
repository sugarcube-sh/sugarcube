import {
    type ResolvedToken,
    type ResolvedTokens,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import type { PathIndex } from "./path-index";
import type { SlimToken, TokenDiffEntry } from "./types";

/** Reduce a resolved token to the DTCG-author shape ($value + optional $extensions). */
function slimToken({ $value, $extensions }: ResolvedToken): SlimToken {
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
    const groups = new Map<string, TokenDiffEntry>();
    const sigsPerPath = new Map<string, Set<string>>();
    const totals = new Map<string, number>();

    for (const [path, indexEntries] of pathIndex.entries()) {
        totals.set(path, indexEntries.length);
        for (const { context, key } of indexEntries) {
            const current = resolved[key];
            const original = snapshotResolved[key];
            if (!isResolvedToken(current) || !isResolvedToken(original)) continue;

            const from = slimToken(original);
            const to = slimToken(current);
            const fromKey = JSON.stringify(from);
            const toKey = JSON.stringify(to);
            if (fromKey === toKey) continue;

            const sig = `${path}\u0000${fromKey}\u0000${toKey}`;
            const existing = groups.get(sig);
            if (existing) {
                existing.contexts.push(context);
            } else {
                groups.set(sig, {
                    path,
                    sourcePath: current.$source.sourcePath,
                    contexts: [context],
                    from,
                    to,
                });
                const sigs = sigsPerPath.get(path);
                if (sigs) {
                    sigs.add(sig);
                } else {
                    sigsPerPath.set(path, new Set([sig]));
                }
            }
        }
    }

    for (const entry of groups.values()) {
        const uniqueSigs = sigsPerPath.get(entry.path)?.size ?? 0;
        const total = totals.get(entry.path) ?? 0;
        if (uniqueSigs === 1 && entry.contexts.length === total) {
            entry.contexts = [];
        }
    }

    return [...groups.values()];
}
