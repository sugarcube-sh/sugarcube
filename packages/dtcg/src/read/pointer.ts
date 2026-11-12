import type { Node } from "jsonc-parser";
import type { DiagnosticDetailByKind } from "../model.js";
import { child } from "./json.js";

export type PointerResult = { ok: true; node: Node } | { ok: false; step: number };

const badEscape = /~(?![01])/;
const badEscapes = new RegExp(badEscape.source, "g");

export type PointerParseResult =
    | { ok: true; steps: string[] }
    | {
          ok: false;
          problem: DiagnosticDetailByKind["malformed-pointer"]["reason"];
          corrected: string;
          correctedSteps: string[];
      };

export function parsePointerText(text: string): PointerParseResult {
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
        return { ok: false, problem, corrected, correctedSteps: escaped.map(unescapeStep) };
    }
    return { ok: true, steps: written.map(unescapeStep) };
}

function unescapeStep(step: string): string {
    return step.replaceAll("~1", "/").replaceAll("~0", "~");
}

export function parsePointer(text: string): string[] | undefined {
    const read = parsePointerText(text);
    return read.ok ? read.steps : undefined;
}

export function refSteps(ref: string): string[] | undefined {
    return ref.startsWith("#") ? parsePointer(ref) : undefined;
}

export function resolvePointer(root: Node, steps: string[]): PointerResult {
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
