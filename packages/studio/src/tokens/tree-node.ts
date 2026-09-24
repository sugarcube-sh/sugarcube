import { SUGARCUBE_NAMESPACE, type TokenTree } from "@sugarcube-sh/core/client";

/**
 * Every authored node at a path, in tree order — a path can appear in several
 * trees, once per context. Callers take the first that carries what they want,
 * because a base tree may declare the node while a context tree declares the
 * detail, or the other way round.
 *
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

/** What an authored node keeps under `$extensions` for sugarcube, if anything. */
export function sugarcubeExtensions(node: unknown): Record<string, unknown> | undefined {
    if (!node || typeof node !== "object") return undefined;
    const extensions = (node as { $extensions?: Record<string, unknown> }).$extensions;
    const own = extensions?.[SUGARCUBE_NAMESPACE];
    return own && typeof own === "object" ? (own as Record<string, unknown>) : undefined;
}
