/**
 * Compute the diff between the studio's current resolved tokens and the
 * live baseline. Used by the diff panel and by the save flow to figure
 * out what to write to disk / submit as a PR.
 *
 * Two kinds of entries:
 *   - leaf entries — per-token value changes
 *   - scale entries — group-level scale-extension edits, which suppress
 *     the per-leaf diffs they own (so commits write the scale extension
 *     back, not the N generated leaves)
 */

import {
    type ResolvedToken,
    type ResolvedTokens,
    SUGARCUBE_NAMESPACE,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import { selectOriginalScale } from "../store/scale-state";
import type { ScaleBindingMeta, ScaleEdit } from "../store/scale-types";
import type { PathIndex } from "./path-index";
import type { SlimToken, TokenDiffEntry, TokenSnapshot } from "./types";

// Reduce a resolved token to the DTCG-author shape.
// Resolved tokens have a bunch of extra metadata we don't want or need here.
function slimToken({ $value, $extensions }: ResolvedToken): SlimToken {
    if ($extensions && Object.keys($extensions).length > 0) {
        return { $value, $extensions };
    }
    return { $value };
}

/**
 * Diff edited tokens against the baseline snapshot.
 *
 * Core resolves each permutation independently — a dark-mode project
 * has two separate entries per path in the resolved map. A raw diff
 * would show identical changes twice. This groups by (path, from, to)
 * into one entry per distinct change, with `contexts` listing the
 * affected perms — or empty when every perm shares the change
 * (shorthand for "applies everywhere").
 *
 * Example: editing `space.md` from 16px → 20px in both light and dark
 * produces one entry with `contexts: []`, not two.
 *
 * Scale-extension-driven groups: when a scale extension at a group
 * path has changed, all its leaf tokens have changed too. We emit a
 * single group-level diff for the extension and suppress the per-leaf
 * diffs that descend from it, so commits write the extension back
 * rather than N individual leaves.
 */
export function computeDiff(
    resolved: ResolvedTokens,
    baseline: TokenSnapshot,
    pathIndex: PathIndex,
    edits?: Record<string, ScaleEdit>,
    bindings?: Record<string, ScaleBindingMeta>
): TokenDiffEntry[] {
    const scaleOwnedPrefixes = collectScaleOwnedPrefixes(bindings);

    const groups = new Map<string, TokenDiffEntry>();
    const sigsPerPath = new Map<string, Set<string>>();
    const totals = new Map<string, number>();

    for (const [path, indexEntries] of pathIndex.entries()) {
        if (isOwnedByScale(path, scaleOwnedPrefixes)) continue;

        totals.set(path, indexEntries.length);
        for (const { context, key } of indexEntries) {
            const current = resolved[key];
            const original = baseline.resolved[key];
            if (!isResolvedToken(current) || !isResolvedToken(original)) continue;

            const from = slimToken(original);
            const to = slimToken(current);
            const fromKey = JSON.stringify(from);
            const toKey = JSON.stringify(to);
            if (fromKey === toKey) continue;

            const sig = `${path} ${fromKey} ${toKey}`;
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

    const leafEntries = [...groups.values()];
    const scaleEntries = computeScaleDiffs(baseline, edits, bindings);
    return [...scaleEntries, ...leafEntries];
}

function collectScaleOwnedPrefixes(
    bindings: Record<string, ScaleBindingMeta> | undefined
): string[] {
    if (!bindings) return [];
    return Object.values(bindings)
        .filter((meta) => meta.kind === "scale")
        .map((meta) => meta.parentPath);
}

function isOwnedByScale(path: string, prefixes: string[]): boolean {
    for (const prefix of prefixes) {
        if (path === prefix || path.startsWith(`${prefix}.`)) return true;
    }
    return false;
}

function computeScaleDiffs(
    baseline: TokenSnapshot,
    edits: Record<string, ScaleEdit> | undefined,
    bindings: Record<string, ScaleBindingMeta> | undefined
): TokenDiffEntry[] {
    if (!edits || !bindings) return [];
    const entries: TokenDiffEntry[] = [];

    for (const [token, edit] of Object.entries(edits)) {
        if (edit.kind !== "scale") continue;
        const meta = bindings[token];
        if (!meta || meta.kind !== "scale") continue;

        const original = selectOriginalScale(baseline, meta.parentPath);
        const fromKey = JSON.stringify(original);
        const toKey = JSON.stringify(edit.scale);
        if (fromKey === toKey) continue;

        entries.push({
            path: meta.parentPath,
            sourcePath: meta.sourcePath,
            contexts: [],
            from: {
                $extensions: { [SUGARCUBE_NAMESPACE]: { scale: original } },
            },
            to: {
                $extensions: { [SUGARCUBE_NAMESPACE]: { scale: edit.scale } },
            },
        });
    }

    return entries;
}
