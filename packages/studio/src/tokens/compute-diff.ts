import {
    type ResolvedToken,
    type ResolvedTokens,
    SUGARCUBE_NAMESPACE,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import type { ScaleBindingMeta, ScaleEdit } from "../store/scale-types";
import type { PathIndex } from "./path-index";
import { getScaleExtension } from "./scale-extension";
import type {
    PathIndexEntry,
    SlimToken,
    TokenDiffEntry,
    TokenDiffKind,
    TokenSnapshot,
} from "./types";

function slimToken({ $value, $description, $extensions }: ResolvedToken): SlimToken {
    const slim: SlimToken = { $value };
    if ($description) slim.$description = $description;
    if ($extensions && Object.keys($extensions).length > 0) slim.$extensions = $extensions;
    return slim;
}

export type ScaleDiffInput = {
    edits?: Record<string, ScaleEdit>;
    bindings?: Record<string, ScaleBindingMeta>;
    bases?: Record<string, string>;
    authoredBases?: Record<string, string>;
};

export type ComputeDiffInput = {
    resolved: ResolvedTokens;
    baseline: Pick<TokenSnapshot, "resolved" | "trees">;
    /** Where the tokens live now, after any renaming and creating. */
    index: PathIndex;
    /** Where they lived before. Leave it out and a rename or a deletion reads
     * as no change at all, since every path matches itself. */
    baselineIndex?: PathIndex;
    scale?: ScaleDiffInput;
};

/**
 * Make the same edit in light and dark and you get one entry naming both, not
 * two entries. Make it in every context a token has and the entry names none of
 * them, because listing every context says no more than saying nothing.
 */
function bySignature() {
    const entries = new Map<string, TokenDiffEntry>();
    const signatures = new Map<string, Set<string>>();
    const totals = new Map<string, number>();

    return {
        expect(handle: string, contexts: number) {
            totals.set(handle, contexts);
        },
        add(signature: string, context: string, make: () => TokenDiffEntry) {
            const existing = entries.get(signature);
            if (existing) {
                existing.contexts.push(context);
                return;
            }
            const entry = make();
            entries.set(signature, entry);
            const seen = signatures.get(entry.handle);
            if (seen) seen.add(signature);
            else signatures.set(entry.handle, new Set([signature]));
        },
        list(): TokenDiffEntry[] {
            for (const entry of entries.values()) {
                const unanimous =
                    signatures.get(entry.handle)?.size === 1 &&
                    entry.contexts.length === (totals.get(entry.handle) ?? 0);
                if (unanimous) entry.contexts = [];
            }
            return [...entries.values()];
        },
    };
}

export function computeDiff(input: ComputeDiffInput): TokenDiffEntry[] {
    const { resolved, baseline, index: pathIndex, baselineIndex } = input;
    const { edits, bindings, bases, authoredBases } = input.scale ?? {};

    const scaleOwnedPrefixes = collectScaleOwnedPrefixes(bindings);
    const base = baselineIndex ?? pathIndex;

    const changed = bySignature();
    const moved: TokenDiffEntry[] = [];
    const created: TokenDiffEntry[] = [];

    for (const [handle, indexEntries] of pathIndex.entries()) {
        const path = pathIndex.pathOf(handle);
        if (path === undefined || isOwnedByScale(path, scaleOwnedPrefixes)) continue;

        const basePath = base.pathOf(handle);

        if (basePath === undefined) {
            const entry = addedEntry(resolved, handle, path, indexEntries);
            if (entry) created.push(entry);
            continue;
        }

        const kind: TokenDiffKind = basePath === path ? "changed" : "renamed";
        let changedAnyContext = false;

        const baseEntries = base.entriesFor(handle);
        const baselineKey = (context: string, fallback: string) =>
            baseEntries.find((entry) => entry.context === context)?.key ?? fallback;

        changed.expect(handle, indexEntries.length);
        for (const { context, key } of indexEntries) {
            const current = resolved[key];
            const original = baseline.resolved[baselineKey(context, key)];
            if (!isResolvedToken(current) || !isResolvedToken(original)) continue;

            const from = slimToken(original);
            const to = slimToken(current);
            const fromKey = JSON.stringify(from);
            const toKey = JSON.stringify(to);
            if (fromKey === toKey) continue;
            changedAnyContext = true;

            changed.add(`${handle} ${fromKey} ${toKey}`, context, () => ({
                kind,
                handle,
                path,
                basePath,
                sourcePath: current.$source.sourcePath,
                contexts: [context],
                from,
                to,
            }));
        }

        if (kind === "renamed" && !changedAnyContext) {
            const entry = movedEntry(
                resolved,
                baseline,
                handle,
                path,
                basePath,
                indexEntries,
                baselineKey,
            );
            if (entry) moved.push(entry);
        }
    }

    const removed = removedEntries(baseline, pathIndex, base, scaleOwnedPrefixes);
    const scaleEntries = computeScaleDiffs(baseline, edits, bindings);
    const baseEntries = computeScaleBaseDiffs(bindings, bases, authoredBases);
    const groupEntries = computeGroupDescriptionDiffs(resolved, baseline, pathIndex, base);
    return [
        ...scaleEntries,
        ...baseEntries,
        ...groupEntries,
        ...created,
        ...moved,
        ...removed,
        ...changed.list(),
    ];
}

function addedEntry(
    resolved: ResolvedTokens,
    handle: string,
    path: string,
    entries: readonly PathIndexEntry[],
): TokenDiffEntry | undefined {
    for (const { key } of entries) {
        const token = resolved[key];
        if (!isResolvedToken(token)) continue;
        return {
            kind: "added",
            handle,
            path,
            sourcePath: token.$source.sourcePath,
            contexts: [],
            from: {},
            to: slimToken(token),
        };
    }
    return undefined;
}

function movedEntry(
    resolved: ResolvedTokens,
    baseline: Pick<TokenSnapshot, "resolved" | "trees">,
    handle: string,
    path: string,
    basePath: string,
    entries: readonly PathIndexEntry[],
    baselineKey: (context: string, fallback: string) => string,
): TokenDiffEntry | undefined {
    for (const { context, key } of entries) {
        const token = resolved[key];
        const original = baseline.resolved[baselineKey(context, key)];
        if (!isResolvedToken(token) || !isResolvedToken(original)) continue;
        return {
            kind: "renamed",
            handle,
            path,
            basePath,
            sourcePath: original.$source.sourcePath,
            contexts: [],
            from: slimToken(original),
            to: slimToken(token),
        };
    }
    return undefined;
}

function removedEntries(
    baseline: Pick<TokenSnapshot, "resolved" | "trees">,
    working: PathIndex,
    base: PathIndex,
    scaleOwnedPrefixes: string[],
): TokenDiffEntry[] {
    const out: TokenDiffEntry[] = [];

    for (const [handle, entries] of base.entries()) {
        if (working.pathOf(handle) !== undefined) continue;

        const basePath = base.pathOf(handle);
        if (basePath === undefined || isOwnedByScale(basePath, scaleOwnedPrefixes)) continue;

        for (const { key } of entries) {
            const original = baseline.resolved[key];
            if (!isResolvedToken(original)) continue;
            out.push({
                kind: "removed",
                handle,
                path: basePath,
                basePath,
                sourcePath: original.$source.sourcePath,
                contexts: [],
                from: slimToken(original),
                to: {},
            });
            break;
        }
    }

    return out;
}

function computeGroupDescriptionDiffs(
    resolved: ResolvedTokens,
    baseline: Pick<TokenSnapshot, "resolved" | "trees">,
    pathIndex: PathIndex,
    base: PathIndex,
): TokenDiffEntry[] {
    const changed = bySignature();

    for (const [handle, indexEntries] of pathIndex.groupEntries()) {
        const path = pathIndex.pathOf(handle);
        const basePath = base.pathOf(handle);
        if (path === undefined || basePath === undefined) continue;

        changed.expect(handle, indexEntries.length);
        for (const { context } of indexEntries) {
            const current = pathIndex.readGroup(resolved, handle, context);
            const original = base.readGroup(baseline.resolved, handle, context);
            if (!current || !original) continue;
            if (current.$description === original.$description) continue;

            const sourcePath = original.$source?.sourcePath;
            if (!sourcePath) continue;

            const signature = `${handle} ${original.$description} -> ${current.$description}`;
            changed.add(signature, context, () => ({
                kind: "changed",
                handle,
                path,
                basePath,
                sourcePath,
                contexts: [context],
                from: { $description: original.$description },
                to: { $description: current.$description },
            }));
        }
    }

    return changed.list();
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
    baseline: Pick<TokenSnapshot, "resolved" | "trees">,
    edits: Record<string, ScaleEdit> | undefined,
    bindings: Record<string, ScaleBindingMeta> | undefined,
): TokenDiffEntry[] {
    if (!edits || !bindings) return [];
    const entries: TokenDiffEntry[] = [];

    for (const [token, edit] of Object.entries(edits)) {
        if (edit.kind !== "scale") continue;
        const meta = bindings[token];
        if (!meta || meta.kind !== "scale") continue;

        const original = getScaleExtension(baseline.trees, meta.parentPath) ?? null;
        const fromKey = JSON.stringify(original);
        const toKey = JSON.stringify(edit.scale);
        if (fromKey === toKey) continue;

        entries.push({
            kind: "changed",
            handle: meta.parentPath,
            path: meta.parentPath,
            basePath: meta.parentPath,
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

function computeScaleBaseDiffs(
    bindings: Record<string, ScaleBindingMeta> | undefined,
    bases: Record<string, string> | undefined,
    authoredBases: Record<string, string> | undefined,
): TokenDiffEntry[] {
    if (!bindings || !bases) return [];

    const entries: TokenDiffEntry[] = [];
    for (const [token, basePath] of Object.entries(bases)) {
        const authored = authoredBases?.[token];
        if (authored === basePath) continue;

        const meta = bindings[token];
        if (!meta) continue;

        entries.push({
            kind: "changed",
            handle: meta.parentPath,
            path: meta.parentPath,
            basePath: meta.parentPath,
            sourcePath: meta.sourcePath,
            contexts: [],
            from: authored
                ? { $extensions: { [SUGARCUBE_NAMESPACE]: { scaleBase: authored } } }
                : {},
            to: { $extensions: { [SUGARCUBE_NAMESPACE]: { scaleBase: basePath } } },
        });
    }
    return entries;
}
