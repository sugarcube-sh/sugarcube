import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core";

/** The snapshot shape that initializes a Studio session. */
export type TokenSnapshot = {
    formatVersion: number;
    generatedAt: string;
    sourceConfigPath: string;
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

/** One entry in the path index: a (context, key) pair for a given canonical $path. */
export type PathIndexEntry = {
    /** The token's $source.context — canonical permutation identifier */
    context: string;
    /** The lookup key in ResolvedTokens for this (path, context) pair */
    key: string;
};

/**
 * The DTCG-author-facing slim shape of a token — just the fields a
 * designer would write in a token JSON file.
 */
export type SlimToken = {
    $value: unknown;
    $extensions?: Record<string, unknown>;
};

/** A change between the original snapshot and the current state. */
export type TokenDiffEntry = {
    /** Token path WITHOUT the permutation prefix (e.g. `panel.radius`) */
    path: string;
    /** The source file this token was defined in. */
    sourcePath: string;
    /** Permutation contexts this change applies to. Empty if identical across all. */
    contexts: string[];
    /** The slim DTCG token shape from the snapshot. */
    from: SlimToken;
    /** The slim DTCG token shape after edits. */
    to: SlimToken;
};

/** A single token update for batch operations. */
export type TokenUpdate = {
    path: string;
    value: unknown;
    context?: string;
};

/**
 * Placeholder type for the sugarcube scale extension.
 * Will be replaced by the real type from core when implemented.
 */
export type ScaleExtension = {
    mode: "exponential" | "multipliers";
    [key: string]: unknown;
};
