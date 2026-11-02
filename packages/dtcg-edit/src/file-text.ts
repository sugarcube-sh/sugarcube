import type { DesignTokens, JsonPath, Definition, Span, JsonValue } from "@sugarcube-sh/dtcg";
import type { FileOp } from "./index.js";
import { type Node, findNodeAtOffset, parseTree } from "jsonc-parser";
import { getJsonAt, getJsonPath, getSpan } from "@sugarcube-sh/dtcg/editor";

export interface Member {
    span: Span;
    jsonPath: JsonPath;
    asWritten: JsonValue;
}

const parsed = new WeakMap<DesignTokens, Map<string, Node | undefined>>();

function treeOf(tokens: DesignTokens, file: string): Node | undefined {
    const trees = parsed.get(tokens) ?? new Map<string, Node | undefined>();
    parsed.set(tokens, trees);
    if (!trees.has(file)) {
        const text = tokens.getText(file);
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

export function memberOf(tokens: DesignTokens, place: Definition): Member {
    return {
        span: getSpan(tokens, place),
        jsonPath: getJsonPath(tokens, place),
        asWritten: place.asWritten,
    };
}

export function opsAt(
    tokens: DesignTokens,
    at: Member,
    inside: JsonPath,
    value: JsonValue | null,
): FileOp[] {
    const { file } = at.span;
    const jsonPath = [...at.jsonPath, ...inside];
    const was = getJsonAt(tokens, file, jsonPath);
    if (value === null) return was === undefined ? [] : [{ kind: "remove", file, jsonPath, was }];
    return was === undefined
        ? [{ kind: "add", file, jsonPath, value }]
        : [{ kind: "set", file, jsonPath, value, was }];
}
