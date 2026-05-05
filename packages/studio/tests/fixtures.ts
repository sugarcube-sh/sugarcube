/**
 * Test fixtures — minimal builders for resolved tokens, snapshots, and
 * the path-index/snapshot shapes the studio's pure functions expect.
 *
 * These mimic what the core pipeline produces but skip the cost of
 * running the actual pipeline. Each helper takes only the fields the
 * subject under test cares about; everything else is filled with
 * sensible defaults.
 */

import type { ResolvedToken, ResolvedTokens, TokenTree } from "@sugarcube-sh/core/client";
import type { TokenSnapshot } from "../src/tokens/types";

type ResolvedFixture<T = unknown> = {
    /** The token's bare `$path` (e.g. "size.step.0"). */
    path: string;
    /** Default value — also used for `$resolvedValue` unless overridden. */
    value: T;
    /** Permutation context. Defaults to "default". */
    context?: string;
    /** Source file path. Defaults to "tokens.json". */
    sourcePath?: string;
    /** Token type. Defaults to "dimension". */
    type?: string;
    /** Optional `$extensions`. */
    extensions?: Record<string, unknown>;
    /** Override the lookup key. Defaults to `${context}::${path}`. */
    key?: string;
};

/** Build a ResolvedTokens map from a list of fixtures. */
export function resolved(...fixtures: ResolvedFixture[]): ResolvedTokens {
    const out: ResolvedTokens = {};
    for (const f of fixtures) {
        const context = f.context ?? "default";
        const key = f.key ?? `${context}::${f.path}`;
        out[key] = {
            $type: (f.type ?? "dimension") as ResolvedToken["$type"],
            $value: f.value,
            $resolvedValue: f.value,
            $path: f.path,
            $originalPath: f.path,
            $source: { context: f.context, sourcePath: f.sourcePath ?? "tokens.json" },
            ...(f.extensions ? { $extensions: f.extensions } : {}),
        } as ResolvedToken;
    }
    return out;
}

/** Build a TokenTree (just enough for selectors that walk `tree.tokens`). */
export function tree(sourcePath: string, tokens: Record<string, unknown>): TokenTree {
    return { sourcePath, tokens } as TokenTree;
}

type SnapshotFixture = {
    trees?: TokenTree[];
    resolved?: ResolvedTokens;
};

/** Build a minimal TokenSnapshot — config is stubbed; selectors that touch it should pass an explicit one. */
export function snapshot(s: SnapshotFixture = {}): TokenSnapshot {
    return {
        formatVersion: 1,
        generatedAt: "",
        sourceConfigPath: "",
        config: {} as TokenSnapshot["config"],
        trees: s.trees ?? [],
        resolved: s.resolved ?? {},
    };
}
