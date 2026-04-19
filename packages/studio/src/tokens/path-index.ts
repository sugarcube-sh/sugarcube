import { type ResolvedTokens, isResolvedToken } from "@sugarcube-sh/core/client";
import type { PathIndexEntry } from "./types";

/**
 * Looks up permutation variants of a token by its semantic name.
 *
 * The resolver produces one big flat dictionary of tokens. A token
 * defined once per permutation (light, dark, brand-A, brand-B) becomes
 * that many entries — same `$path`, different internal key, different
 * `$value` per variant.
 *
 * PathIndex is the inverse lookup: given a `$path` like `color.primary`,
 * which entries represent it? Features then narrow to whichever scope
 * they need — a color picker targets just the current mode's variant;
 * a palette swap walks every variant to rebind per-mode references;
 * a diff iterates all variants to see what changed.
 *
 * It's the primitive every Studio feature is built on. Without it,
 * every picker, slider, swap, and diff would need to re-implement
 * the find-variants dance.
 */
export class PathIndex {
    private index: Map<string, PathIndexEntry[]>;

    constructor(resolved: ResolvedTokens) {
        this.index = PathIndex.build(resolved);
    }

    private static build(resolved: ResolvedTokens): Map<string, PathIndexEntry[]> {
        const index = new Map<string, PathIndexEntry[]>();
        for (const [key, token] of Object.entries(resolved)) {
            if (!isResolvedToken(token)) continue;
            const context = token.$source.context ?? "default";
            const entry: PathIndexEntry = { context, key };
            const existing = index.get(token.$path);
            if (existing) {
                existing.push(entry);
            } else {
                index.set(token.$path, [entry]);
            }
        }
        return index;
    }

    /** Read a token's $value by canonical path. */
    readValue(resolved: ResolvedTokens, barePath: string, context?: string): unknown {
        const entries = this.index.get(barePath);
        if (!entries || entries.length === 0) return undefined;

        const entry = context ? entries.find((e) => e.context === context) : entries[0];
        if (!entry) return undefined;

        const token = resolved[entry.key];
        if (!token || !("$value" in token)) return undefined;
        return token.$value;
    }

    /** Immutably update a token's $value across all permutations (or a specific context). */
    setValue(
        resolved: ResolvedTokens,
        barePath: string,
        newValue: unknown,
        context?: string
    ): ResolvedTokens {
        const entries = this.index.get(barePath);
        if (!entries || entries.length === 0) return resolved;

        const targetEntries = context ? entries.filter((e) => e.context === context) : entries;

        const updates: ResolvedTokens = {};
        for (const { key } of targetEntries) {
            const existing = resolved[key];
            if (!existing || !("$value" in existing)) continue;
            updates[key] = {
                ...existing,
                $value: newValue,
            } as ResolvedTokens[string];
        }
        return { ...resolved, ...updates };
    }

    /** All permutation contexts in snapshot order. */
    get contexts(): readonly string[] {
        const seen = new Set<string>();
        for (const entries of this.index.values()) {
            for (const { context } of entries) {
                seen.add(context);
            }
        }
        return Array.from(seen);
    }

    /** All lookup keys for a given canonical path. */
    keysFor(barePath: string): readonly string[] {
        const entries = this.index.get(barePath);
        if (!entries) return [];
        return entries.map((e) => e.key);
    }

    /** All entries for a given path (context + key pairs). */
    entriesFor(barePath: string): readonly PathIndexEntry[] {
        return this.index.get(barePath) ?? [];
    }

    /** All (path, entries) pairs. */
    entries(): IterableIterator<[string, PathIndexEntry[]]> {
        return this.index.entries();
    }

    /**
     * Find all token paths matching a glob pattern.
     * `*` matches exactly one path segment.
     */
    matching(pattern: string): readonly string[] {
        const patternSegs = pattern.split(".");
        const matches: string[] = [];
        for (const path of this.index.keys()) {
            const pathSegs = path.split(".");
            if (pathSegs.length !== patternSegs.length) continue;
            let ok = true;
            for (let i = 0; i < patternSegs.length; i++) {
                if (patternSegs[i] === "*") continue;
                if (patternSegs[i] !== pathSegs[i]) {
                    ok = false;
                    break;
                }
            }
            if (ok) matches.push(path);
        }
        return matches;
    }

    /** Find all token paths under a prefix (any depth). */
    under(prefix: string): readonly string[] {
        const needle = `${prefix}.`;
        const matches: string[] = [];
        for (const path of this.index.keys()) {
            if (path.startsWith(needle)) matches.push(path);
        }
        return matches;
    }
}
