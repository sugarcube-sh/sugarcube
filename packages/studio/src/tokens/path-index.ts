import { type ResolvedTokens, isResolvedToken } from "@sugarcube-sh/core/client";
import type { PathIndexEntry } from "./types";

/**
 * Inverse lookup from a token's semantic `$path` to all its permutation
 * variants in the resolved map.
 *
 * A token defined once per permutation (light, dark, brand-A…) shows up
 * as multiple entries in the flat resolved map — same `$path`, different
 * internal keys. This class groups them so callers can work by path and
 * narrow to a specific context when needed.
 */
export class PathIndex {
    private index: Map<string, PathIndexEntry[]>;

    constructor(resolved: ResolvedTokens) {
        this.index = PathIndex.build(resolved);
    }

    /**
     * Rebuild the internal index against a new resolved map. The instance
     * reference is preserved — long-lived closures (store actions like
     * `setToken`, recipe/scale apply functions) hold this reference and
     * pick up the fresh internals on their next call without rebinding.
     *
     * Called by `TokenStoreProvider` when the host pushes a baseline whose
     * key set has changed (e.g. an externally-added token in a JSON file).
     */
    refresh(resolved: ResolvedTokens): void {
        this.index = PathIndex.build(resolved);
    }

    /**
     * The set of resolved-map keys this index covers. Used by the baseline
     * subscription as a cheap "did the structure change?" check before
     * triggering a refresh on a value-only update.
     */
    resolvedKeys(): IterableIterator<string> {
        const keys: string[] = [];
        for (const entries of this.index.values()) {
            for (const { key } of entries) keys.push(key);
        }
        return keys[Symbol.iterator]();
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

    readValue(resolved: ResolvedTokens, barePath: string, context?: string): unknown {
        const entries = this.index.get(barePath);
        if (!entries || entries.length === 0) return undefined;

        const entry = context ? entries.find((e) => e.context === context) : entries[0];
        if (!entry) return undefined;

        const token = resolved[entry.key];
        if (!token || !("$value" in token)) return undefined;
        return token.$value;
    }

    // Immutably update a token's $value across all permutations (or a specific context).
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

    // In snapshot order.
    get contexts(): readonly string[] {
        const seen = new Set<string>();
        for (const entries of this.index.values()) {
            for (const { context } of entries) {
                seen.add(context);
            }
        }
        return Array.from(seen);
    }

    keysFor(barePath: string): readonly string[] {
        const entries = this.index.get(barePath);
        if (!entries) return [];
        return entries.map((e) => e.key);
    }

    entriesFor(barePath: string): readonly PathIndexEntry[] {
        return this.index.get(barePath) ?? [];
    }

    entries(): IterableIterator<[string, PathIndexEntry[]]> {
        return this.index.entries();
    }

    // `*` matches exactly one path segment; `**` is not supported.
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

    // Find all token paths under a prefix (any depth).
    under(prefix: string): readonly string[] {
        const needle = `${prefix}.`;
        const matches: string[] = [];
        for (const path of this.index.keys()) {
            if (path.startsWith(needle)) matches.push(path);
        }
        return matches;
    }
}
