export type { ConvertedToken, ConvertedTokens } from "@sugarcube-sh/core";

import type { ConvertedToken } from "@sugarcube-sh/core";

/** DTCG group metadata (no $type, no $value) */
export interface NodeMetadata {
    $description?: string;
    $extensions?: { [key: string]: unknown };
}

export interface PermutationMeta {
    input: Record<string, string>;
    selector: string | string[];
}

export interface TokenData {
    tokens: Record<string, Record<string, ConvertedToken | NodeMetadata>> | null;
    config: { resolver: string | null; tokenDirs: string[] };
    permutations: PermutationMeta[];
}

/** Derived context info for the UI */
export interface ContextInfo {
    key: string;
    label: string;
    isBase: boolean;
}

/** A node in the reconstructed DTCG token tree */
export interface TokenTreeNode {
    /** The segment name at this level (e.g., "color", "surface", "default") */
    name: string;
    /** Full dot-path from root (e.g., "color.surface.default") */
    path: string;
    /** Group metadata ($description, $extensions) if present */
    metadata?: NodeMetadata;
    /** Child groups, keyed by segment name */
    children: Map<string, TokenTreeNode>;
    /** Tokens directly at this level */
    tokens: ConvertedToken[];
}

/** The full tree for one context */
export interface TokenTree {
    /** Top-level nodes (groups or root-level tokens) */
    roots: Map<string, TokenTreeNode>;
    /** Total token count across the entire tree */
    tokenCount: number;
}
