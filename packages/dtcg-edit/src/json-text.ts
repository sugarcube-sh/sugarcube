import type { JsonValue } from "@sugarcube-sh/dtcg";
import { type Node, findNodeAtLocation } from "jsonc-parser";

export interface Splice {
    offset: number;
    length: number;
    text: string;
}

export function refString(node: Node): Node | undefined {
    if (node.type === "string") return node;
    const ref = findNodeAtLocation(node, ["$ref"]);
    return ref?.type === "string" ? ref : undefined;
}

export function spliced(text: string, splices: readonly Splice[]): string {
    return [...splices]
        .sort((a, b) => b.offset - a.offset)
        .reduce(
            (acc, { offset, length, text: inserted }) =>
                acc.slice(0, offset) + inserted + acc.slice(offset + length),
            text,
        );
}

export function removal(text: string, value: Node): Splice[] {
    const member = value.parent?.type === "property" ? value.parent : value;
    const container = member.parent;
    const members = container?.children;
    if (!container || !members) return [];

    const comma = commaAfter(text, member);
    const after = comma === undefined ? end(member) : comma + 1;
    const inside = { from: container.offset + 1, to: end(container) - 1 };
    const rest = text.slice(inside.from, member.offset) + text.slice(after, inside.to);
    if (members.length === 1 && rest.trim() === "") {
        return [{ offset: inside.from, length: inside.to - inside.from, text: "" }];
    }

    const index = members.indexOf(member);
    const previous = members[index - 1];
    const next = members[index + 1];
    const start = lineStart(text, member.offset);

    if (onItsOwnLines(text, start, member.offset, after)) {
        const lines = { offset: start, length: nextLineStart(text, after) - start, text: "" };
        const previousComma =
            previous && !next && comma === undefined ? commaAfter(text, previous) : undefined;
        return previousComma === undefined
            ? [lines]
            : [lines, { offset: previousComma, length: 1, text: "" }];
    }

    const previousComma = previous && commaAfter(text, previous);
    if (next && previousComma !== undefined) {
        return [{ offset: previousComma + 1, length: after - previousComma - 1, text: "" }];
    }
    if (next) return [{ offset: member.offset, length: next.offset - member.offset, text: "" }];
    const from = previous ? end(previous) : member.offset;
    return [{ offset: from, length: end(member) - from, text: "" }];
}

export function insertion(text: string, container: Node, key: string, value: JsonValue): Splice[] {
    const members = container.children ?? [];
    const last = members[members.length - 1];
    const unit = indentUnit(text);
    const eol = lineBreak(text);

    if (!last) {
        const outer = indentOf(text, container.offset);
        const inner = outer + unit;
        const member = `${JSON.stringify(key)}: ${spread(value, inner, unit, eol)}`;
        const close = end(container) - 1;
        if (text.slice(container.offset + 1, close).trim() === "") {
            return [
                {
                    offset: container.offset,
                    length: container.length,
                    text: `{${eol}${inner}${member}${eol}${outer}}`,
                },
            ];
        }
        const closeLine = lineStart(text, close);
        return text.slice(closeLine, close).trim() === ""
            ? [{ offset: closeLine, length: 0, text: `${inner}${member}${eol}` }]
            : [{ offset: close, length: 0, text: `${eol}${inner}${member}${eol}${outer}` }];
    }

    const lastEnd = end(last);
    const start = lineStart(text, last.offset);
    if (text.slice(start, last.offset).trim() !== "") {
        return [{ offset: lastEnd, length: 0, text: `, ${JSON.stringify(key)}: ${inline(value)}` }];
    }

    const indent = indentOf(text, last.offset);
    const written = text.slice(last.offset, lastEnd).includes("\n")
        ? spread(value, indent, unit, eol)
        : inline(value);
    const line = `${eol}${indent}${JSON.stringify(key)}: ${written}`;
    const comma = commaAfter(text, last);
    if (comma !== undefined) return [{ offset: lineEnd(text, comma), length: 0, text: `${line},` }];
    const at = lineEnd(text, lastEnd);
    if (at === lastEnd) return [{ offset: lastEnd, length: 0, text: `,${line}` }];
    return [
        { offset: lastEnd, length: 0, text: "," },
        { offset: at, length: 0, text: line },
    ];
}

export function replacement(text: string, node: Node, value: JsonValue): Splice {
    const written = text.slice(node.offset, end(node)).includes("\n")
        ? spread(value, indentOf(text, node.offset), indentUnit(text), lineBreak(text))
        : inline(value);
    return { offset: node.offset, length: node.length, text: written };
}

export function inline(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(inline).join(", ")}]`;
    if (typeof value !== "object" || value === null) return JSON.stringify(value);
    const members = Object.entries(value).map(
        ([key, each]) => `${JSON.stringify(key)}: ${inline(each)}`,
    );
    return `{ ${members.join(", ")} }`;
}

function spread(value: JsonValue, indent: string, unit: string, eol: string): string {
    return JSON.stringify(value, null, unit).split("\n").join(`${eol}${indent}`);
}

export function lineBreak(text: string): string {
    return /\r?\n/.exec(text)?.[0] ?? "\n";
}

function end(node: Node): number {
    return node.offset + node.length;
}

function commaAfter(text: string, node: Node): number | undefined {
    let at = end(node);
    while (at < text.length) {
        const rest = text.slice(at);
        const skipped = /^\s+|^\/\/[^\n]*|^\/\*[\s\S]*?\*\//.exec(rest)?.[0];
        if (!skipped) break;
        at += skipped.length;
    }
    return text[at] === "," ? at : undefined;
}

function onItsOwnLines(text: string, start: number, offset: number, after: number): boolean {
    if (text.slice(start, offset).trim() !== "") return false;
    const rest = text.slice(after, lineEnd(text, after)).trim();
    return rest === "" || rest.startsWith("//");
}

function lineStart(text: string, offset: number): number {
    return text.lastIndexOf("\n", offset - 1) + 1;
}

function lineEnd(text: string, offset: number): number {
    const at = text.indexOf("\n", offset);
    if (at === -1) return text.length;
    return text[at - 1] === "\r" ? at - 1 : at;
}

function nextLineStart(text: string, offset: number): number {
    const at = text.indexOf("\n", offset);
    return at === -1 ? text.length : at + 1;
}

function indentOf(text: string, offset: number): string {
    const start = lineStart(text, offset);
    return /^[\t ]*/.exec(text.slice(start))?.[0] ?? "";
}

export function indentUnit(text: string): string {
    const steps = new Map<number, number>();
    let tabs = 0;
    let spaces = 0;
    let previous = 0;

    for (const line of text.split("\n")) {
        if (line.trim() === "") continue;
        const indent = /^[\t ]*/.exec(line)?.[0] ?? "";
        if (indent.includes("\t")) tabs += 1;
        else if (indent.length > 0) spaces += 1;
        const step = indent.length - previous;
        if (step > 0) steps.set(step, (steps.get(step) ?? 0) + 1);
        previous = indent.length;
    }

    if (tabs > spaces) return "\t";
    let best = 2;
    let seen = 0;
    for (const [step, count] of steps) {
        if (count > seen) {
            best = step;
            seen = count;
        }
    }
    return " ".repeat(best);
}
