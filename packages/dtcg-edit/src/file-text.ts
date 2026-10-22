import type { DesignTokens, JsonPath, Span, JsonValue } from "@sugarcube-sh/dtcg";
import type { FileOp } from "./index.js";
import {
    type Node,
    findNodeAtLocation,
    findNodeAtOffset,
    getNodePath,
    getNodeValue,
    parseTree,
} from "jsonc-parser";

export interface Member {
    span: Span;
    jsonPath: JsonPath;
    written: JsonValue;
}

const parsed = new WeakMap<DesignTokens, Map<string, Node | undefined>>();

function treeOf(tokens: DesignTokens, file: string): Node | undefined {
    const trees = parsed.get(tokens) ?? new Map<string, Node | undefined>();
    parsed.set(tokens, trees);
    if (!trees.has(file)) {
        const text = tokens.text(file);
        trees.set(file, text === undefined ? undefined : parseTree(text));
    }
    return trees.get(file);
}

export function nodeAt(tokens: DesignTokens, { file, offset, length }: Span): Node | undefined {
    const tree = treeOf(tokens, file);
    let node = tree && findNodeAtOffset(tree, offset);
    while (node && (node.offset !== offset || node.length !== length)) node = node.parent;
    return node;
}

export function writtenIn(
    tokens: DesignTokens,
    file: string,
    jsonPath: JsonPath,
): JsonValue | undefined {
    const tree = treeOf(tokens, file);
    const node = tree && findNodeAtLocation(tree, [...jsonPath]);
    return node && (getNodeValue(node) as JsonValue);
}

export function memberAt(tokens: DesignTokens, span: Span): Member | undefined {
    const node = nodeAt(tokens, span);
    return node && { span, jsonPath: getNodePath(node), written: getNodeValue(node) as JsonValue };
}

export function opsAt(
    tokens: DesignTokens,
    at: Member,
    inside: JsonPath,
    value: JsonValue | null,
): FileOp[] {
    const { file } = at.span;
    const jsonPath = [...at.jsonPath, ...inside];
    const was = writtenIn(tokens, file, jsonPath);
    if (value === null) return was === undefined ? [] : [{ kind: "remove", file, jsonPath, was }];
    return was === undefined
        ? [{ kind: "add", file, jsonPath, value }]
        : [{ kind: "set", file, jsonPath, value, was }];
}
