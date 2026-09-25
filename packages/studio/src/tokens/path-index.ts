import {
    type ResolvedToken,
    type ResolvedTokens,
    isResolvedToken,
} from "@sugarcube-sh/core/client";
import type { PathIndexEntry } from "./types";

type GroupNode = {
    $path: string;
    $description?: string;
    $source?: { context?: string; sourcePath?: string };
};

function isGroupNode(value: unknown): value is GroupNode {
    return (
        typeof value === "object" &&
        value !== null &&
        !("$value" in value) &&
        "$path" in value &&
        typeof (value as { $path: unknown }).$path === "string"
    );
}

/**
 * A token's id, which stays the same when the token is renamed or moved. It
 * starts out as the token's path, and keeps that value even once the path has
 * changed underneath it, so `colour.brand` can be the id of a token now called
 * `colour.primary`.
 */
export type Handle = string;

export type PathIndexAccessor = () => PathIndex;

type IndexState = {
    tokens: Map<Handle, PathIndexEntry[]>;
    groups: Map<Handle, PathIndexEntry[]>;
    paths: Map<Handle, string>;
    handles: Map<string, Handle>;
};

export class PathIndex {
    private state: IndexState;

    /**
     * `identify` looks up the id a path already had. Leave it out and each
     * token's id is simply its path, which is correct before anything is
     * renamed.
     */
    constructor(resolved: ResolvedTokens, identify?: (path: string) => Handle) {
        this.state = PathIndex.build(resolved, identify);
    }

    private static build(
        resolved: ResolvedTokens,
        identify?: (path: string) => Handle,
    ): IndexState {
        const tokens = new Map<Handle, PathIndexEntry[]>();
        const groups = new Map<Handle, PathIndexEntry[]>();
        const paths = new Map<Handle, string>();
        const handles = new Map<string, Handle>();

        const record = (
            map: Map<Handle, PathIndexEntry[]>,
            path: string,
            context: string,
            key: string,
        ) => {
            const entry: PathIndexEntry = { context, key };
            const handle = identify?.(path) ?? path;
            const existing = map.get(handle);
            if (existing) existing.push(entry);
            else map.set(handle, [entry]);

            paths.set(handle, path);
            handles.set(path, handle);
        };

        for (const [key, node] of Object.entries(resolved)) {
            if (isResolvedToken(node)) {
                record(tokens, node.$path, node.$source.context ?? "default", key);
            } else if (isGroupNode(node)) {
                record(groups, node.$path, node.$source?.context ?? "default", key);
            }
        }

        return { tokens, groups, paths, handles };
    }

    pathOf(handle: Handle): string | undefined {
        return this.state.paths.get(handle);
    }

    handleAt(path: string): Handle | undefined {
        return this.state.handles.get(path);
    }

    /** Every current path with the handle that owns it. */
    allHandles(): IterableIterator<[string, Handle]> {
        return this.state.handles.entries();
    }

    isGroup(handle: Handle): boolean {
        return this.state.groups.has(handle);
    }

    groupEntries(): IterableIterator<[Handle, PathIndexEntry[]]> {
        return this.state.groups.entries();
    }

    readGroup(resolved: ResolvedTokens, handle: Handle, context?: string) {
        const entries = this.state.groups.get(handle);
        if (!entries || entries.length === 0) return undefined;

        const entry = context ? entries.find((e) => e.context === context) : entries[0];
        if (!entry) return undefined;

        const node = resolved[entry.key];
        return node && isGroupNode(node) ? node : undefined;
    }

    /** The resolved token itself, in the given context. */
    readToken(resolved: ResolvedTokens, handle: Handle, context?: string) {
        const entries = this.state.tokens.get(handle);
        if (!entries || entries.length === 0) return undefined;

        const entry = context ? entries.find((e) => e.context === context) : entries[0];
        if (!entry) return undefined;

        const token = resolved[entry.key];
        return token && "$value" in token ? (token as ResolvedToken) : undefined;
    }

    readValue(resolved: ResolvedTokens, handle: Handle, context?: string): unknown {
        return this.readToken(resolved, handle, context)?.$value;
    }

    readDescription(
        resolved: ResolvedTokens,
        handle: Handle,
        context?: string,
    ): string | undefined {
        return (
            this.readToken(resolved, handle, context)?.$description ??
            this.readGroup(resolved, handle, context)?.$description
        );
    }

    get contexts(): readonly string[] {
        const seen = new Set<string>();
        for (const entries of this.state.tokens.values()) {
            for (const { context } of entries) {
                seen.add(context);
            }
        }
        return Array.from(seen);
    }

    entriesFor(handle: Handle): readonly PathIndexEntry[] {
        return this.state.tokens.get(handle) ?? [];
    }

    groupEntriesFor(handle: Handle): readonly PathIndexEntry[] {
        return this.state.groups.get(handle) ?? [];
    }

    entries(): IterableIterator<[Handle, PathIndexEntry[]]> {
        return this.state.tokens.entries();
    }

    /** Token handles whose current path matches, `*` standing for one segment. */
    matching(pattern: string): readonly Handle[] {
        const patternSegs = pattern.split(".");
        const matches: Handle[] = [];
        for (const [handle, path] of this.state.paths) {
            if (!this.state.tokens.has(handle)) continue;
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
            if (ok) matches.push(handle);
        }
        return matches;
    }

    under(prefix: string): readonly Handle[] {
        const needle = `${prefix}.`;
        const matches: Handle[] = [];
        for (const [handle, path] of this.state.paths) {
            if (!this.state.tokens.has(handle)) continue;
            if (path.startsWith(needle)) matches.push(handle);
        }
        return matches;
    }

    childTokens(prefix: string): readonly Handle[] {
        return this.directChildren(this.state.tokens, prefix);
    }

    childGroups(prefix: string): readonly Handle[] {
        return this.directChildren(this.state.groups, prefix);
    }

    private directChildren(map: Map<Handle, PathIndexEntry[]>, prefix: string): readonly Handle[] {
        const needle = prefix === "" ? "" : `${prefix}.`;
        const matches: Handle[] = [];
        for (const [handle, path] of this.state.paths) {
            if (!map.has(handle) || !path.startsWith(needle)) continue;
            const rest = path.slice(needle.length);
            if (rest.length > 0 && !rest.includes(".")) matches.push(handle);
        }
        return matches;
    }
}
