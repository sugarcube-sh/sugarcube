import type { DesignTokens, JsonPath, Definition, Span, JsonValue } from "@sugarcube-sh/dtcg";
import type { FileOp } from "./index.js";
import { type Node, findNodeAtOffset, parseTree } from "jsonc-parser";
import { getJsonAt, getJsonPath, getSpan } from "@sugarcube-sh/dtcg/editor";

export interface Member {
    span: Span;
    jsonPath: JsonPath;
    json: JsonValue;
}

const treesByTokens = new WeakMap<DesignTokens, Map<string, Node | undefined>>();

function getTree(tokens: DesignTokens, file: string): Node | undefined {
    const trees = treesByTokens.get(tokens) ?? new Map<string, Node | undefined>();
    treesByTokens.set(tokens, trees);
    if (!trees.has(file)) {
        const text = tokens.getText(file);
        trees.set(file, text === undefined ? undefined : parseTree(text));
    }
    return trees.get(file);
}

export function findNode(tokens: DesignTokens, { file, offset, length }: Span): Node | undefined {
    const tree = getTree(tokens, file);
    let node = tree && findNodeAtOffset(tree, offset);
    while (node && (node.offset !== offset || node.length !== length)) node = node.parent;
    return node;
}

export function findEnclosingToken(
    tokens: DesignTokens,
    file: string,
    offset: number,
): { offset: number; length: number } | undefined {
    const tree = getTree(tokens, file);
    for (let node = tree && findNodeAtOffset(tree, offset); node; node = node.parent) {
        const [, value] = node.type === "property" ? (node.children ?? []) : [];
        const members = value?.type === "object" ? (value.children ?? []) : [];
        if (members.some((member) => ["$value", "$ref"].includes(member.children?.[0]?.value))) {
            return { offset: node.offset, length: node.length };
        }
    }
    return undefined;
}

export function toMember(tokens: DesignTokens, definition: Definition): Member {
    return {
        span: getSpan(tokens, definition),
        jsonPath: getJsonPath(tokens, definition),
        json: definition.json,
    };
}

export function createWriteOps(
    tokens: DesignTokens,
    member: Member,
    innerPath: JsonPath,
    value: JsonValue | null,
): FileOp[] {
    const { file } = member.span;
    const jsonPath = [...member.jsonPath, ...innerPath];
    const was = getJsonAt(tokens, file, jsonPath);
    if (value === null) return was === undefined ? [] : [{ kind: "remove", file, jsonPath, was }];
    return was === undefined
        ? [{ kind: "add", file, jsonPath, value }]
        : [{ kind: "set", file, jsonPath, value, was }];
}
