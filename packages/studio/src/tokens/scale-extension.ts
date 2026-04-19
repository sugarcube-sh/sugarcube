import type { TokenTree } from "@sugarcube-sh/core/client";
import type { ScaleExtension } from "./types";

/**
 * Walk the snapshot's source trees looking for a `sh.sugarcube.scale`
 * extension at the given path. Returns undefined if no scale extension
 * exists at that location.
 *
 * Scale extensions are authored at group level in source token files
 * (not on individual tokens), so we walk the raw trees rather than
 * querying resolved tokens.
 */
export function getScaleExtension(trees: TokenTree[], path: string): ScaleExtension | undefined {
    const segments = path.split(".");
    for (const tree of trees) {
        const node = walkTree(tree, segments);
        const scale = extractScaleExtension(node);
        if (scale) return scale;
    }
    return undefined;
}

function walkTree(tree: unknown, segments: string[]): unknown {
    let node: unknown = tree;
    for (const segment of segments) {
        if (!node || typeof node !== "object") return undefined;
        node = (node as Record<string, unknown>)[segment];
    }
    return node;
}

function extractScaleExtension(node: unknown): ScaleExtension | undefined {
    if (!node || typeof node !== "object") return undefined;
    const extensions = (node as { $extensions?: Record<string, unknown> }).$extensions;
    const sugarcube = extensions?.["sh.sugarcube"] as { scale?: unknown } | undefined;
    const scale = sugarcube?.scale;
    if (
        scale &&
        typeof scale === "object" &&
        "mode" in scale &&
        (scale.mode === "exponential" || scale.mode === "multipliers")
    ) {
        return scale as ScaleExtension;
    }
    return undefined;
}
