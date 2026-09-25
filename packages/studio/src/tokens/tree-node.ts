import { SUGARCUBE_NAMESPACE, type TokenTree } from "@sugarcube-sh/core/client";

/**
 * The same path can be written once per context, so this hands back every
 * version of it, in the order the trees resolve. Callers take the first one
 * carrying the field they came for: the base tree might name the token while
 * the dark tree only changes its value, or the other way round.
 */
export function nodesAt(trees: readonly TokenTree[], path: string): unknown[] {
    const segments = path.split(".");
    const found: unknown[] = [];
    for (const tree of trees) {
        const node = walk(tree.tokens, segments);
        if (node !== undefined) found.push(node);
    }
    return found;
}

function walk(tree: unknown, segments: readonly string[]): unknown {
    let node: unknown = tree;
    for (const segment of segments) {
        if (!node || typeof node !== "object") return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return node;
}

export function sugarcubeExtensions(node: unknown): Record<string, unknown> | undefined {
    if (!node || typeof node !== "object") return undefined;
    const extensions = (node as { $extensions?: Record<string, unknown> }).$extensions;
    const own = extensions?.[SUGARCUBE_NAMESPACE];
    return own && typeof own === "object" ? (own as Record<string, unknown>) : undefined;
}
