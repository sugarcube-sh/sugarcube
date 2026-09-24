import { useMemo } from "react";
import { usePathIndex } from "../store/hooks";
import { type TokenNode, buildTree } from "../tokens/groups";
import { GROUP_PRESENTATION } from "./registry";

export function useTokenTree(): TokenNode[] {
    const pathIndex = usePathIndex();
    return useMemo(() => buildTree(pathIndex, GROUP_PRESENTATION), [pathIndex]);
}

export function useRootNode(name: string | undefined): TokenNode | undefined {
    const tree = useTokenTree();
    return tree.find((node) => node.name === name);
}

export function useNodeAt(path: string | undefined): TokenNode | undefined {
    const tree = useTokenTree();
    return useMemo(() => (path ? findNode(tree, path) : undefined), [tree, path]);
}

export function findNode(tree: TokenNode[], path: string): TokenNode | undefined {
    let level = tree;
    let found: TokenNode | undefined;
    for (const segment of path.split(".")) {
        found = level.find((node) => node.name === segment);
        if (!found) return undefined;
        level = found.children;
    }
    return found;
}
