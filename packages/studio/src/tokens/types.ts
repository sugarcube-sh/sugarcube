import type { InternalConfig, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";

/** The snapshot shape that initializes a Studio session. */
export type TokenSnapshot = {
    formatVersion: number;
    generatedAt: string;
    sourceConfigPath: string;
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
};

export type PathIndexEntry = {
    /** The token's $source.context — canonical permutation identifier */
    context: string;
    /** The lookup key in ResolvedTokens for this (path, context) pair */
    key: string;
};

/**
 * The DTCG-author-facing slim shape of a token — just the fields a
 * designer/dev would write in a token JSON file.
 *
 * `$value` is optional because diff entries can describe group-level
 * changes (e.g. an edited `$extensions.sh.sugarcube.scale` recipe on
 * a parent group node, which has no `$value` of its own).
 */
export type SlimToken = {
    $value?: unknown;
    $extensions?: Record<string, unknown>;
};

/** A change between the original snapshot and the current state. */
export type TokenDiffEntry = {
    /** Token path WITHOUT the permutation prefix (e.g. `panel.radius`) */
    path: string;
    sourcePath: string;
    /** Permutation contexts this change applies to. Empty if identical across all. */
    contexts: string[];
    from: SlimToken;
    to: SlimToken;
};

/** A single token update for batch operations. */
export type TokenUpdate = {
    path: string;
    value: unknown;
    context?: string;
};

/** `context` scopes to a permutation; omitted reads the first variant. */
export type TokenReader = (path: string, context?: string) => unknown;

// `ScaleExtension` now lives in `@sugarcube-sh/core/client`. Studio code
// should import it directly from there.
