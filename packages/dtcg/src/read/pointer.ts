import type { Node } from "jsonc-parser";

export type Followed = { ok: true; node: Node } | { ok: false; step: number };

const arrayIndex = /^(?:0|[1-9]\d*)$/;
const badEscape = /~(?![01])/;

export function parsePointer(text: string): string[] | undefined {
    const pointer = text.startsWith("#") ? text.slice(1) : text;
    if (pointer === "") return [];
    if (!pointer.startsWith("/")) return undefined;

    const steps: string[] = [];
    for (const step of pointer.slice(1).split("/")) {
        if (badEscape.test(step)) return undefined;
        steps.push(step.replaceAll("~1", "/").replaceAll("~0", "~"));
    }
    return steps;
}

export function follow(root: Node, steps: string[]): Followed {
    let node = root;
    for (const [index, step] of steps.entries()) {
        const next = child(node, step);
        if (!next) return { ok: false, step: index };
        node = next;
    }
    return { ok: true, node };
}

function child(node: Node, step: string): Node | undefined {
    if (node.type === "array") {
        return arrayIndex.test(step) ? node.children?.[Number(step)] : undefined;
    }
    if (node.type !== "object") return undefined;

    let found: Node | undefined;
    for (const property of node.children ?? []) {
        if (property.children?.[0]?.value === step) found = property.children[1];
    }
    return found;
}

export function encodePointer(steps: (string | number)[]): string {
    return `#${steps.map((step) => `/${String(step).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("")}`;
}
