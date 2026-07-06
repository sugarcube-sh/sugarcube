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

function slimToken({ $value, $extensions }: ResolvedToken): SlimToken {
    if ($extensions && Object.keys($extensions).length > 0) {
        return { $value, $extensions };
    }
    return { $value };
}

export function computeDiff(
    resolved: ResolvedTokens,
    baseline: TokenSnapshot,
    pathIndex: PathIndex,
    edits?: Record<string, ScaleEdit>,
    bindings?: Record<string, ScaleBindingMeta>,
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
    bindings: Record<string, ScaleBindingMeta> | undefined,
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
    bindings: Record<string, ScaleBindingMeta> | undefined,
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
