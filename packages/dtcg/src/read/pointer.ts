import type { Node } from "jsonc-parser";
import type { DiagnosticDetailByKind } from "../index.js";

export type Followed = { ok: true; node: Node } | { ok: false; step: number };

const arrayIndex = /^(?:0|[1-9]\d*)$/;
const badEscape = /~(?![01])/;
const badEscapes = new RegExp(badEscape.source, "g");

export type PointerReading =
    | { ok: true; steps: string[] }
    | {
          ok: false;
          problem: DiagnosticDetailByKind["malformed-pointer"]["reason"];
          corrected: string;
      };

export function readPointerText(text: string): PointerReading {
    const pointer = text.startsWith("#") ? text.slice(1) : text;
    if (pointer === "") return { ok: true, steps: [] };

    const slashed = pointer.startsWith("/") ? pointer : `/${pointer}`;
    const written = slashed.slice(1).split("/");
    const problem = !pointer.startsWith("/")
        ? "no-leading-slash"
        : written.some((step) => badEscape.test(step))
          ? "bad-escape"
          : undefined;
    if (problem) {
        const escaped = written.map((step) => step.replaceAll(badEscapes, "~0"));
        return { ok: false, problem, corrected: `#/${escaped.join("/")}` };
    }
    const steps = written.map((step) => step.replaceAll("~1", "/").replaceAll("~0", "~"));
    return { ok: true, steps };
}

export function parsePointer(text: string): string[] | undefined {
    const read = readPointerText(text);
    return read.ok ? read.steps : undefined;
}

export function refSteps(ref: string): string[] | undefined {
    return ref.startsWith("#") ? parsePointer(ref) : undefined;
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
