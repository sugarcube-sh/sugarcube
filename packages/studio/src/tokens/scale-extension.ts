import {
    type ResolvedTokens,
    type ScaleExtension,
    type TokenTree,
    isScaleExtension,
} from "@sugarcube-sh/core/client";
import type { PathIndex } from "./path-index";
import { parentPath } from "./paths";
import { nodesAt, sugarcubeExtensions } from "./tree-node";

export function getScaleExtension(
    trees: readonly TokenTree[],
    path: string,
): ScaleExtension | undefined {
    for (const node of nodesAt(trees, path)) {
        const scale = extractScaleExtension(node);
        if (scale) return scale;
    }
    return undefined;
}

/**
 * Every group in the document that carries a recipe, by path: a group holding a
 * `sh.sugarcube.scale` extension has one, and that is the whole test (D-037).
 *
 * Resolution flattens groups away, so this walks the authored trees. A path can
 * appear in several of them, once per context; it is listed once.
 */
export function scaleGroupPaths(trees: readonly TokenTree[]): string[] {
    const paths = new Set<string>();

    const visit = (node: unknown, path: string): void => {
        if (!node || typeof node !== "object") return;
        if (extractScaleExtension(node)) paths.add(path);

        for (const [key, child] of Object.entries(node)) {
            if (key.startsWith("$")) continue;
            visit(child, path ? `${path}.${key}` : key);
        }
    };

    for (const tree of trees) visit(tree.tokens, "");
    return Array.from(paths);
}

export function getScaleBase(trees: readonly TokenTree[], path: string): string | undefined {
    for (const node of nodesAt(trees, path)) {
        const scaleBase = sugarcubeExtensions(node)?.scaleBase;
        if (typeof scaleBase === "string") return scaleBase;
    }
    return undefined;
}

/**
 * Groups whose own children are dimensions and which carry no recipe — the
 * hand-authored scales, which are most of them.
 */
export function directScaleGroups(pathIndex: PathIndex, resolved: ResolvedTokens): string[] {
    const counts = new Map<string, number>();
    for (const [handle] of pathIndex.entries()) {
        const path = pathIndex.pathOf(handle);
        const parent = path === undefined ? "" : parentPath(path);
        if (!parent) continue;
        const token = pathIndex.readToken(resolved, handle);
        if (token?.$type !== "dimension") continue;
        counts.set(parent, (counts.get(parent) ?? 0) + 1);
    }

    return Array.from(counts)
        .filter(([, count]) => count > 1)
        .map(([group]) => group);
}

function extractScaleExtension(node: unknown): ScaleExtension | undefined {
    const scale = sugarcubeExtensions(node)?.scale;
    return isScaleExtension(scale) ? scale : undefined;
}
