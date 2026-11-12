import { type Node, findNodeAtOffset, getNodePath, parseTree } from "jsonc-parser";
import { exceptionMessages } from "../error-messages.js";
import type { DesignTokens, JsonPath, Span } from "../model.js";

interface ParseCache {
    trees: Map<string, Node | undefined>;
    paths: Map<Span, JsonPath>;
}

const parseCaches = new WeakMap<DesignTokens, ParseCache>();

function getParseCache(tokens: DesignTokens): ParseCache {
    let known = parseCaches.get(tokens);
    if (!known) {
        known = { trees: new Map(), paths: new Map() };
        parseCaches.set(tokens, known);
    }
    return known;
}

export function getTree(tokens: DesignTokens, file: string): Node | undefined {
    const { trees } = getParseCache(tokens);
    if (!trees.has(file)) {
        const text = tokens.getText(file);
        trees.set(file, text === undefined ? undefined : parseTree(text));
    }
    return trees.get(file);
}

export function findJsonPath(tokens: DesignTokens, span: Span): JsonPath {
    const { paths } = getParseCache(tokens);
    const found = paths.get(span);
    if (found) return found;
    const path = getNodePath(findNode(tokens, span));
    paths.set(span, path);
    return path;
}

export function findNode(tokens: DesignTokens, { file, offset, length }: Span): Node {
    const tree = getTree(tokens, file);
    let node = tree && findNodeAtOffset(tree, offset);
    while (node && (node.offset !== offset || node.length !== length)) node = node.parent;
    if (!node) throw new Error(exceptionMessages.noDefinitionAtLocation(file));
    return node;
}
