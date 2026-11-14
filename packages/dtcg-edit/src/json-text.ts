import type { JsonValue } from "@sugarcube-sh/dtcg";
import { type Node, findNodeAtLocation } from "jsonc-parser";

export interface Splice {
    offset: number;
    length: number;
    text: string;
}

export function findReferenceString(node: Node): Node | undefined {
    if (node.type === "string") return node;
    const ref = findNodeAtLocation(node, ["$ref"]);
    return ref?.type === "string" ? ref : undefined;
}

export function applySplices(text: string, splices: readonly Splice[]): string {
    return [...splices]
        .sort((a, b) => b.offset - a.offset)
        .reduce(
            (acc, { offset, length, text: inserted }) =>
                acc.slice(0, offset) + inserted + acc.slice(offset + length),
            text,
        );
}

export function getRemovalSplices(text: string, value: Node): Splice[] {
    const member = value.parent?.type === "property" ? value.parent : value;
    const container = member.parent;
    const members = container?.children;
    if (!container || !members) return [];

    const comma = findCommaAfter(text, member);
    const after = comma === undefined ? getEnd(member) : comma + 1;
    const innerRange = { from: container.offset + 1, to: getEnd(container) - 1 };
    const rest = text.slice(innerRange.from, member.offset) + text.slice(after, innerRange.to);
    if (members.length === 1 && rest.trim() === "") {
        return [{ offset: innerRange.from, length: innerRange.to - innerRange.from, text: "" }];
    }

    const index = members.indexOf(member);
    const previous = members[index - 1];
    const next = members[index + 1];
    const start = getLineStart(text, member.offset);

    if (isOnOwnLines(text, start, member.offset, after)) {
        const lines = { offset: start, length: getNextLineStart(text, after) - start, text: "" };
        const previousComma =
            previous && !next && comma === undefined ? findCommaAfter(text, previous) : undefined;
        return previousComma === undefined
            ? [lines]
            : [lines, { offset: previousComma, length: 1, text: "" }];
    }

    const previousComma = previous && findCommaAfter(text, previous);
    if (next && previousComma !== undefined) {
        return [{ offset: previousComma + 1, length: after - previousComma - 1, text: "" }];
    }
    if (next) return [{ offset: member.offset, length: next.offset - member.offset, text: "" }];
    const from = previous ? getEnd(previous) : member.offset;
    return [{ offset: from, length: getEnd(member) - from, text: "" }];
}

export function getInsertionSplices(
    text: string,
    container: Node,
    key: string,
    value: JsonValue,
): Splice[] {
    const members = container.children ?? [];
    const last = members[members.length - 1];
    const unit = detectIndentUnit(text);
    const eol = detectLineBreak(text);

    if (!last) {
        const outer = getIndent(text, container.offset);
        const inner = outer + unit;
        const member = `${JSON.stringify(key)}: ${formatMultiline(value, inner, unit, eol)}`;
        const close = getEnd(container) - 1;
        if (text.slice(container.offset + 1, close).trim() === "") {
            return [
                {
                    offset: container.offset,
                    length: container.length,
                    text: `{${eol}${inner}${member}${eol}${outer}}`,
                },
            ];
        }
        const closeLine = getLineStart(text, close);
        return text.slice(closeLine, close).trim() === ""
            ? [{ offset: closeLine, length: 0, text: `${inner}${member}${eol}` }]
            : [{ offset: close, length: 0, text: `${eol}${inner}${member}${eol}${outer}` }];
    }

    const lastEnd = getEnd(last);
    const start = getLineStart(text, last.offset);
    if (text.slice(start, last.offset).trim() !== "") {
        return [
            {
                offset: lastEnd,
                length: 0,
                text: `, ${JSON.stringify(key)}: ${formatInline(value)}`,
            },
        ];
    }

    const indent = getIndent(text, last.offset);
    const formattedValue = text.slice(last.offset, lastEnd).includes("\n")
        ? formatMultiline(value, indent, unit, eol)
        : formatInline(value);
    const line = `${eol}${indent}${JSON.stringify(key)}: ${formattedValue}`;
    const comma = findCommaAfter(text, last);
    if (comma !== undefined)
        return [{ offset: getLineEnd(text, comma), length: 0, text: `${line},` }];
    const at = getLineEnd(text, lastEnd);
    if (at === lastEnd) return [{ offset: lastEnd, length: 0, text: `,${line}` }];
    return [
        { offset: lastEnd, length: 0, text: "," },
        { offset: at, length: 0, text: line },
    ];
}

export function getReplacementSplice(text: string, node: Node, value: JsonValue): Splice {
    const formattedValue = text.slice(node.offset, getEnd(node)).includes("\n")
        ? formatMultiline(
              value,
              getIndent(text, node.offset),
              detectIndentUnit(text),
              detectLineBreak(text),
          )
        : formatInline(value);
    return { offset: node.offset, length: node.length, text: formattedValue };
}

export function formatInline(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(formatInline).join(", ")}]`;
    if (typeof value !== "object" || value === null) return JSON.stringify(value);
    const members = Object.entries(value).map(
        ([key, each]) => `${JSON.stringify(key)}: ${formatInline(each)}`,
    );
    return `{ ${members.join(", ")} }`;
}

function formatMultiline(value: JsonValue, indent: string, unit: string, eol: string): string {
    return JSON.stringify(value, null, unit).split("\n").join(`${eol}${indent}`);
}

export function detectLineBreak(text: string): string {
    return /\r?\n/.exec(text)?.[0] ?? "\n";
}

function getEnd(node: Node): number {
    return node.offset + node.length;
}

function findCommaAfter(text: string, node: Node): number | undefined {
    let at = getEnd(node);
    while (at < text.length) {
        const rest = text.slice(at);
        const whitespaceOrComment = /^\s+|^\/\/[^\n]*|^\/\*[\s\S]*?\*\//.exec(rest)?.[0];
        if (!whitespaceOrComment) break;
        at += whitespaceOrComment.length;
    }
    return text[at] === "," ? at : undefined;
}

function isOnOwnLines(text: string, start: number, offset: number, after: number): boolean {
    if (text.slice(start, offset).trim() !== "") return false;
    const rest = text.slice(after, getLineEnd(text, after)).trim();
    return rest === "" || rest.startsWith("//");
}

function getLineStart(text: string, offset: number): number {
    return text.lastIndexOf("\n", offset - 1) + 1;
}

function getLineEnd(text: string, offset: number): number {
    const at = text.indexOf("\n", offset);
    if (at === -1) return text.length;
    return text[at - 1] === "\r" ? at - 1 : at;
}

function getNextLineStart(text: string, offset: number): number {
    const at = text.indexOf("\n", offset);
    return at === -1 ? text.length : at + 1;
}

function getIndent(text: string, offset: number): string {
    const start = getLineStart(text, offset);
    return /^[\t ]*/.exec(text.slice(start))?.[0] ?? "";
}

export function detectIndentUnit(text: string): string {
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
    let commonestStep = 2;
    let commonestCount = 0;
    for (const [step, count] of steps) {
        if (count > commonestCount) {
            commonestStep = step;
            commonestCount = count;
        }
    }
    return " ".repeat(commonestStep);
}
