import {
    type Node,
    findNodeAtLocation,
    findNodeAtOffset,
    getNodePath,
    parse,
    parseTree,
} from "jsonc-parser";
import { thrownMessages } from "../error-messages.js";
import type { DesignTokens, JsonPath, JsonValue, Span } from "../index.js";

interface Parsed {
    trees: Map<string, Node | undefined>;
    paths: Map<Span, JsonPath>;
}

const parsed = new WeakMap<DesignTokens, Parsed>();

function parsedIn(tokens: DesignTokens): Parsed {
    let known = parsed.get(tokens);
    if (!known) {
        known = { trees: new Map(), paths: new Map() };
        parsed.set(tokens, known);
    }
    return known;
}

function treeOf(tokens: DesignTokens, file: string): Node | undefined {
    const { trees } = parsedIn(tokens);
    if (!trees.has(file)) {
        const text = tokens.text(file);
        trees.set(file, text === undefined ? undefined : parseTree(text));
    }
    return trees.get(file);
}

export function jsonPathIn(tokens: DesignTokens, span: Span): JsonPath {
    const { paths } = parsedIn(tokens);
    const found = paths.get(span);
    if (found) return found;
    const { file, offset, length } = span;
    const tree = treeOf(tokens, file);
    let node = tree && findNodeAtOffset(tree, offset);
    while (node && (node.offset !== offset || node.length !== length)) node = node.parent;
    if (!node) throw new Error(thrownMessages.nothingWrittenThere(file));
    const path = getNodePath(node);
    paths.set(span, path);
    return path;
}

export function jsonIn(
    tokens: DesignTokens,
    file: string,
    jsonPath: JsonPath,
): JsonValue | undefined {
    const tree = treeOf(tokens, file);
    const node = tree && findNodeAtLocation(tree, [...jsonPath]);
    const text = node && tokens.text(file)?.slice(node.offset, node.offset + node.length);
    return text === undefined ? undefined : (parse(text) as JsonValue);
}
