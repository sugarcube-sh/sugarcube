import type {
    InternalConfig,
    Permutation,
    ResolvedTokens,
    TokenSources,
    TokenTree,
} from "@sugarcube-sh/core/client";

/** What a host publishes about disk. A memory source has no files, so `sources` may be null. */
export type StudioDiskState = {
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
    defaultContext: string | null;
    permutations: Permutation[];
    sources: TokenSources | null;
};

/** What Studio works on: the disk state of a host that has files. */
export type TokenSnapshot = {
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
    defaultContext: string | null;
    /** Derived from the resolver at load; the config alone does not know them. */
    permutations: Permutation[];
    /** The files themselves. The working copy (D-044); everything above is derived. */
    sources: TokenSources;
};

export type PathIndexEntry = {
    /** The token's $source.context (canonical permutation identifier). */
    context: string;
    /** The lookup key in ResolvedTokens for this (path, context) pair */
    key: string;
};

export type SlimToken = {
    $value?: unknown;
    $description?: string;
    $extensions?: Record<string, unknown>;
};

export type TokenDiffKind = "added" | "removed" | "changed" | "renamed";

export type TokenDiffEntry = {
    kind: TokenDiffKind;
    /** Identity: the node's baseline path; a node created this session has its own path. */
    handle: string;
    /** Where the node reads now. For a removal, where it was. */
    path: string;
    /** Where its key sits on disk. Absent for an addition. */
    basePath?: string;
    sourcePath: string;
    /** Permutation contexts this change applies to. Empty if identical across all. */
    contexts: string[];
    from: SlimToken;
    to: SlimToken;
};

export type TokenUpdate = {
    path: string;
    value: unknown;
    context?: string;
};

export type TokenReader = (path: string, context?: string) => unknown;
