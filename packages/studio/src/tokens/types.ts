import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";

export type TokenSnapshot = {
    formatVersion: number;
    generatedAt: string;
    sourceConfigPath: string;
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

export type PathIndexEntry = {
    /** The token's $source.context (canonical permutation identifier). */
    context: string;
    /** The lookup key in ResolvedTokens for this (path, context) pair */
    key: string;
};

export type SlimToken = {
    $value?: unknown;
    $extensions?: Record<string, unknown>;
};

export type TokenDiffEntry = {
    /** Token path WITHOUT the permutation prefix (e.g. `panel.radius`) */
    path: string;
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
