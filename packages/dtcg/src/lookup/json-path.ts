import { type Node, findNodeAtOffset, getNodePath, parseTree } from "jsonc-parser";
import { thrownMessages } from "../error-messages.js";
import type { DesignTokens, JsonPath, Span } from "../model.js";

interface Parsed {
    trees: Map<string, Node | undefined>;
    paths: Map<Span, JsonPath>;
}

const parsed = new WeakMap<DesignTokens, Parsed>();

function getParseCache(tokens: DesignTokens): Parsed {
    let known = parsed.get(tokens);
    if (!known) {
        known = { trees: new Map(), paths: new Map() };
        parsed.set(tokens, known);
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
    const { file, offset, length } = span;
    const tree = getTree(tokens, file);
    let node = tree && findNodeAtOffset(tree, offset);
    while (node && (node.offset !== offset || node.length !== length)) node = node.parent;
    if (!node) throw new Error(thrownMessages.nothingWrittenThere(file));
    const path = getNodePath(node);
    paths.set(span, path);
    return path;
}
