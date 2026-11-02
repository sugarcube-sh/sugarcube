import type { Node } from "jsonc-parser";
import type { DiagnosticDetailByKind } from "../model.js";
import { child } from "./json.js";

export type Followed = { ok: true; node: Node } | { ok: false; step: number };

const badEscape = /~(?![01])/;
const badEscapes = new RegExp(badEscape.source, "g");

export type PointerReading =
    | { ok: true; steps: string[] }
    | {
          ok: false;
          problem: DiagnosticDetailByKind["malformed-pointer"]["reason"];
          corrected: string;
          correctedSteps: string[];
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
        const corrected = `#/${escaped.join("/")}`;
        return { ok: false, problem, corrected, correctedSteps: escaped.map(unescaped) };
    }
    return { ok: true, steps: written.map(unescaped) };
}

function unescaped(step: string): string {
    return step.replaceAll("~1", "/").replaceAll("~0", "~");
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

export function encodePointer(steps: readonly (string | number)[]): string {
    return `#${steps.map((step) => `/${String(step).replaceAll("~", "~0").replaceAll("/", "~1")}`).join("")}`;
}
