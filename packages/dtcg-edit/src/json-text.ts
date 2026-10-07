import type { Span } from "@sugarcube-sh/dtcg";
import { type Node, findNodeAtLocation, findNodeAtOffset, parseTree } from "jsonc-parser";

export function nodeAt(text: string, { offset, length }: Span): Node | undefined {
    const tree = parseTree(text);
    let node = tree && findNodeAtOffset(tree, offset);
    while (node && (node.offset !== offset || node.length !== length)) node = node.parent;
    return node;
}

export function refString(node: Node): Node | undefined {
    if (node.type === "string") return node;
    const ref = findNodeAtLocation(node, ["$ref"]);
    return ref?.type === "string" ? ref : undefined;
}

export function memberRemoval(node: Node): { offset: number; length: number } | undefined {
    const property = node.parent;
    if (property?.type !== "property") return undefined;
    const siblings = property.parent?.children ?? [property];
    const index = siblings.indexOf(property);
    const next = siblings[index + 1];
    if (next) return { offset: property.offset, length: next.offset - property.offset };
    const previous = siblings[index - 1];
    const start = previous ? previous.offset + previous.length : property.offset;
    return { offset: start, length: property.offset + property.length - start };
}

export function inline(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(inline).join(", ")}]`;
    if (typeof value !== "object" || value === null) return JSON.stringify(value);
    const members = Object.entries(value).map(
        ([key, each]) => `${JSON.stringify(key)}: ${inline(each)}`,
    );
    return `{ ${members.join(", ")} }`;
}
