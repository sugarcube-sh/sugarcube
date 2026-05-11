import { type ResolvedTokens, isResolvedToken } from "@sugarcube-sh/core/client";
import { sameKeySet } from "./same-key-set";
import type { PathIndexEntry } from "./types";

export class PathIndex {
    private readonly index: Map<string, PathIndexEntry[]>;

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

    resolvedKeys(): IterableIterator<string> {
        const keys: string[] = [];
        for (const entries of this.index.values()) {
            for (const { key } of entries) keys.push(key);
        }
        return keys[Symbol.iterator]();
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

    under(prefix: string): readonly string[] {
        const needle = `${prefix}.`;
        const matches: string[] = [];
        for (const path of this.index.keys()) {
            if (path.startsWith(needle)) matches.push(path);
        }
        return matches;
    }
}

export type PathIndexAccessor = () => PathIndex;

export function createPathIndexAccessor(getSource: () => ResolvedTokens): PathIndexAccessor {
    let cached = new PathIndex(getSource());
    let builtFrom: ResolvedTokens = getSource();
    return () => {
        const current = getSource();
        if (current === builtFrom) return cached;
        builtFrom = current;
        if (!sameKeySet(cached.resolvedKeys(), Object.keys(current))) {
            cached = new PathIndex(current);
        }
        return cached;
    };
}
