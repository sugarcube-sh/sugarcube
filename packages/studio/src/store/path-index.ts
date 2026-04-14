import type { ResolvedTokens, TokenTree } from "@sugarcube-sh/core";
import type { PathIndexEntry, ScaleExtension, TokenSnapshot } from "./types";

/**
 * Index from a token's canonical $path (without permutation prefix)
 * to all (context, key) pairs that share that path — one per permutation.
 *
 * All discovery and read/write operations go through this class so the
 * index format remains an implementation detail.
 */
export class PathIndex {
    private index: Map<string, PathIndexEntry[]>;
    private snapshot: TokenSnapshot;

    constructor(snapshot: TokenSnapshot) {
        this.snapshot = snapshot;
        this.index = PathIndex.build(snapshot.resolved);
    }

    private static build(resolved: ResolvedTokens): Map<string, PathIndexEntry[]> {
        const index = new Map<string, PathIndexEntry[]>();
        for (const [key, token] of Object.entries(resolved)) {
            if (
                token &&
                typeof token === "object" &&
                "$path" in token &&
                "$value" in token &&
                "$source" in token
            ) {
                const $path = (token as { $path: string }).$path;
                const $source = (token as { $source: { context?: string } }).$source;
                const context = $source?.context ?? "default";

                const existing = index.get($path);
                const entry: PathIndexEntry = { context, key };
                if (existing) {
                    existing.push(entry);
                } else {
                    index.set($path, [entry]);
                }
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
    get contexts(): string[] {
        const seen = new Set<string>();
        for (const entries of this.index.values()) {
            for (const { context } of entries) {
                seen.add(context);
            }
        }
        return Array.from(seen);
    }

    /** All lookup keys for a given canonical path. */
    keysFor(barePath: string): string[] {
        const entries = this.index.get(barePath);
        if (!entries) return [];
        return entries.map((e) => e.key);
    }

    /** All entries for a given path (context + key pairs). */
    entriesFor(barePath: string): PathIndexEntry[] {
        return this.index.get(barePath) ?? [];
    }

    /** Iterate all paths in insertion (snapshot) order. */
    paths(): IterableIterator<string> {
        return this.index.keys();
    }

    /** All (path, entries) pairs. */
    entries(): IterableIterator<[string, PathIndexEntry[]]> {
        return this.index.entries();
    }

    /**
     * Find all token paths matching a glob pattern.
     * `*` matches exactly one path segment.
     */
    matching(pattern: string): string[] {
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
    under(prefix: string): string[] {
        const needle = `${prefix}.`;
        const matches: string[] = [];
        for (const path of this.index.keys()) {
            if (path.startsWith(needle)) matches.push(path);
        }
        return matches;
    }

    /** Read a token's $type from the snapshot (static metadata). */
    getType(path: string): string | undefined {
        const entries = this.index.get(path);
        const entry = entries?.[0];
        if (!entry) return undefined;
        const token = this.snapshot.resolved[entry.key];
        if (!token || typeof token !== "object") return undefined;
        return (token as { $type?: string }).$type;
    }

    /** The original snapshot this index was built from. */
    getSnapshot(): TokenSnapshot {
        return this.snapshot;
    }

    /**
     * Walk snapshot trees looking for a scale extension at the given path.
     * Returns undefined if no scale extension exists.
     */
    getScaleExtension(path: string): ScaleExtension | undefined {
        const segments = path.split(".");
        for (const tree of this.snapshot.trees) {
            const node = walkTree(tree, segments);
            const scale = extractScaleExtension(node);
            if (scale) return scale;
        }
        return undefined;
    }

    /**
     * Build a mapping from permutation input shape (serialized as JSON)
     * to canonical context string.
     */
    buildInputToContextMap(): Map<string, string> {
        const map = new Map<string, string>();
        const perms = this.snapshot.config.variables.permutations ?? [];
        const ctxs = this.contexts;

        perms.forEach((perm, index) => {
            const context = ctxs[index];
            if (!context) return;
            const inputKey = JSON.stringify(perm.input ?? {});
            map.set(inputKey, context);
        });

        return map;
    }
}

function walkTree(tree: unknown, segments: string[]): unknown {
    let node: unknown = tree;
    for (const segment of segments) {
        if (!node || typeof node !== "object") return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return node;
}

function extractScaleExtension(node: unknown): ScaleExtension | undefined {
    if (!node || typeof node !== "object") return undefined;
    const extensions = (node as { $extensions?: Record<string, unknown> }).$extensions;
    const sugarcube = extensions?.["sh.sugarcube"] as { scale?: unknown } | undefined;
    const scale = sugarcube?.scale;
    if (
        scale &&
        typeof scale === "object" &&
        "mode" in scale &&
        (scale.mode === "exponential" || scale.mode === "multipliers")
    ) {
        return scale as ScaleExtension;
    }
    return undefined;
}
