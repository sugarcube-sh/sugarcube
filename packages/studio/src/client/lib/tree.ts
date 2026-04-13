import type { ConvertedToken } from "@sugarcube-sh/core";
import type {
    ContextInfo,
    NodeMetadata,
    PermutationMeta,
    TokenTree,
    TokenTreeNode,
} from "../types";

/** Create an empty tree node */
function createNode(name: string, path: string): TokenTreeNode {
    return { name, path, children: new Map(), tokens: [] };
}

/**
 * Ensure a node exists at the given dot-path, creating intermediate nodes
 * as needed. Returns the node at the full path.
 */
function ensureNode(roots: Map<string, TokenTreeNode>, path: string): TokenTreeNode {
    const segments = path.split(".");
    const rootName = segments[0];
    if (rootName === undefined) {
        throw new Error(`Invalid token path (empty): ${path}`);
    }
    let current: TokenTreeNode;

    if (!roots.has(rootName)) {
        roots.set(rootName, createNode(rootName, rootName));
    }
    const rootNode = roots.get(rootName);
    if (!rootNode) {
        throw new Error(`Failed to resolve root node for path: ${path}`);
    }
    current = rootNode;

    for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        if (seg === undefined) {
            throw new Error(`Invalid segment index ${i} for path: ${path}`);
        }
        const childPath = segments.slice(0, i + 1).join(".");
        if (!current.children.has(seg)) {
            current.children.set(seg, createNode(seg, childPath));
        }
        const next = current.children.get(seg);
        if (!next) {
            throw new Error(`Failed to resolve child "${seg}" for path: ${path}`);
        }
        current = next;
    }

    return current;
}

/**
 * Strip the context prefix from a lookup key.
 * e.g., "perm:0.color.surface" with contextKey "perm:0" → "color.surface"
 */
function stripContextPrefix(lookupKey: string, contextKey: string): string {
    const prefix = `${contextKey}.`;
    if (lookupKey.startsWith(prefix)) {
        return lookupKey.slice(prefix.length);
    }
    // If the key IS the context key (root-level metadata), return empty
    if (lookupKey === contextKey) return "";
    return lookupKey;
}

/**
 * Build a token tree from flat converted tokens.
 *
 * Entries with $type are tokens — placed using their $path.
 * Entries without $type are group metadata — path derived from lookup key.
 */
export function buildTokenTree(
    contextKey: string,
    contextTokens: Record<string, ConvertedToken | NodeMetadata>
): TokenTree {
    const roots = new Map<string, TokenTreeNode>();
    let tokenCount = 0;

    // First pass: place all tokens (entries with $type)
    for (const entry of Object.values(contextTokens)) {
        if (!("$type" in entry)) continue;
        const token = entry as ConvertedToken;
        const path = token.$path;
        const segments = path.split(".");

        if (segments.length === 1) {
            // Root-level token (e.g., "cluster-gap")
            const node = ensureNode(roots, path);
            node.tokens.push(token);
        } else {
            // Nested token — parent is everything except the last segment
            const parentPath = segments.slice(0, -1).join(".");
            const parent = ensureNode(roots, parentPath);
            parent.tokens.push(token);
        }
        tokenCount++;
    }

    // Second pass: attach group metadata (entries without $type)
    for (const [lookupKey, entry] of Object.entries(contextTokens)) {
        if ("$type" in entry) continue;
        const metadata = entry as NodeMetadata;
        if (!metadata.$description && !metadata.$extensions) continue;

        const path = stripContextPrefix(lookupKey, contextKey);
        if (!path) continue; // root-level metadata with no path

        const node = ensureNode(roots, path);
        node.metadata = metadata;
    }

    return { roots, tokenCount };
}

/** Recursively count all tokens in a subtree */
export function countTokens(node: TokenTreeNode): number {
    let count = node.tokens.length;
    for (const child of node.children.values()) {
        count += countTokens(child);
    }
    return count;
}

/** Recursively collect all tokens from a subtree */
export function collectTokens(node: TokenTreeNode): ConvertedToken[] {
    const result = [...node.tokens];
    for (const child of node.children.values()) {
        result.push(...collectTokens(child));
    }
    return result;
}

/** Resolve a dot-separated path to a node in the tree */
export function getNodeByPath(tree: TokenTree, path: string): TokenTreeNode | null {
    const segments = path.split(".");
    const first = segments[0];
    if (first === undefined) return null;
    const root = tree.roots.get(first);
    if (!root) return null;
    if (segments.length === 1) return root;

    let current = root;
    for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        if (seg === undefined) return null;
        const child = current.children.get(seg);
        if (!child) return null;
        current = child;
    }
    return current;
}

// ── Context info (unchanged from previous implementation) ──

export function buildContextInfo(
    contextKeys: string[],
    permutations: PermutationMeta[]
): ContextInfo[] {
    return contextKeys.map((key) => {
        if (!key.startsWith("perm:")) {
            return {
                key,
                label: key === "default" ? "Default" : key,
                isBase: key === "default",
            };
        }

        const index = Number.parseInt(key.replace("perm:", ""), 10);
        const perm = permutations[index];

        if (!perm) {
            return { key, label: key, isBase: index === 0 };
        }

        const selector = Array.isArray(perm.selector) ? perm.selector.join(", ") : perm.selector;
        const isBase = selector === ":root" || index === 0;

        const label = formatPermutationLabel(perm, isBase);
        return { key, label, isBase };
    });
}

function formatPermutationLabel(perm: PermutationMeta, isBase: boolean): string {
    const entries = Object.entries(perm.input);
    if (entries.length === 0) return isBase ? "Default" : "Unknown";

    const parts = entries.map(([, value]) => value.charAt(0).toUpperCase() + value.slice(1));
    const label = parts.join(" / ");

    if (isBase && entries.length === 1) {
        return `Default (${label})`;
    }
    return label;
}

export function getSourceFileName(sourcePath: string): string {
    return sourcePath.split("/").pop() ?? sourcePath;
}
