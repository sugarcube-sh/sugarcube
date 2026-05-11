import {
    SUGARCUBE_NAMESPACE,
    type ScaleExtension,
    type TokenTree,
    isScaleExtension,
} from "@sugarcube-sh/core/client";

export function getScaleExtension(trees: TokenTree[], path: string): ScaleExtension | undefined {
    const segments = path.split(".");
    for (const tree of trees) {
        const node = walkTree(tree.tokens, segments);
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
    const sugarcube = extensions?.[SUGARCUBE_NAMESPACE] as { scale?: unknown } | undefined;
    return isScaleExtension(sugarcube?.scale) ? sugarcube.scale : undefined;
}
