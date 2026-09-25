import type {
    InternalConfig,
    Permutation,
    ResolvedTokens,
    TokenSources,
    TokenTree,
} from "@sugarcube-sh/core/client";

/**
 * What the server last read from the token files. It goes to the client over
 * shared state, and again every time the files change on disk.
 */
export type StudioDiskState = {
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
    defaultContext: string | null;
    permutations: Permutation[];
    sources: TokenSources | null;
};

/** The same thing once the client has checked that nothing is missing. */
export type TokenSnapshot = {
    config: InternalConfig;
    trees: TokenTree[];
    resolved: ResolvedTokens;
    defaultContext: string | null;
    /** Comes from the resolver file when tokens load. The config does not list them. */
    permutations: Permutation[];
    /** The token files as text. Everything above is parsed out of this. */
    sources: TokenSources;
};

export type PathIndexEntry = {
    /** Which context this is for, `dark` say, named as core writes it in `$source.context`. */
    context: string;
    /** What to look the token up by in `ResolvedTokens`, for that path in that context. */
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
    handle: string;
    /** The token's path now. For a removal, the path it had. */
    path: string;
    /** The path it had before this edit, so a rename has two. Absent for something new. */
    basePath?: string;
    /** The token file it is written in. */
    sourcePath: string;
    /** The contexts this change applies to. Empty when it applies to all of them. */
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
