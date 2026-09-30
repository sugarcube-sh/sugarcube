import { type Node, parseTree, printParseErrorCode } from "jsonc-parser";
import type { JsonErrorReason, Span } from "../index.js";

export interface JsonFile {
    path: string;
    root: Node;
    lineStarts: number[];
    hidden: Set<Node>;
}

export interface JsonProblem {
    reason: JsonErrorReason;
    offset: number;
    length: number;
}

export interface DuplicateKey {
    key: string;
    first: Node;
    last: Node;
}

export interface ParsedJson {
    root: Node | undefined;
    lineStarts: number[];
    hidden: Set<Node>;
    comments: JsonProblem[];
    syntax?: JsonProblem;
    duplicates: DuplicateKey[];
}

type ParseErrorName = Exclude<ReturnType<typeof printParseErrorCode>, "<unknown ParseErrorCode>">;

const reasons: Record<ParseErrorName, JsonErrorReason> = {
    InvalidSymbol: "invalid-symbol",
    InvalidNumberFormat: "invalid-number-format",
    PropertyNameExpected: "property-name-expected",
    ValueExpected: "value-expected",
    ColonExpected: "colon-expected",
    CommaExpected: "comma-expected",
    CloseBraceExpected: "close-brace-expected",
    CloseBracketExpected: "close-bracket-expected",
    EndOfFileExpected: "end-of-file-expected",
    InvalidCommentToken: "comment",
    UnexpectedEndOfComment: "unexpected-end-of-comment",
    UnexpectedEndOfString: "unexpected-end-of-string",
    UnexpectedEndOfNumber: "unexpected-end-of-number",
    InvalidUnicode: "invalid-unicode",
    InvalidEscapeCharacter: "invalid-escape-character",
    InvalidCharacter: "invalid-character",
};

export function parseJson(text: string): ParsedJson {
    const source = text.startsWith("\uFEFF") ? ` ${text.slice(1)}` : text;
    const lineStarts = findLineStarts(source);
    const errors: { error: number; offset: number; length: number }[] = [];
    const root = parseTree(source, errors, { disallowComments: true });

    const comments: JsonProblem[] = [];
    let syntax: JsonProblem | undefined;
    for (const { error, offset, length } of errors) {
        const name = printParseErrorCode(error);
        const reason = name === "<unknown ParseErrorCode>" ? "invalid-symbol" : reasons[name];
        if (reason === "comment") comments.push({ reason, offset, length });
        else syntax ??= { reason, offset, length };
    }
    if (!root) syntax ??= { reason: "value-expected", offset: 0, length: 0 };

    const duplicates: DuplicateKey[] = [];
    const hidden = new Set<Node>();
    if (root) findDuplicates(root, duplicates, hidden);
    return { root, lineStarts, hidden, comments, syntax, duplicates };
}

function findDuplicates(node: Node, duplicates: DuplicateKey[], hidden: Set<Node>): void {
    if (node.type === "object") {
        const seen = new Map<string, { property: Node; keyNode: Node }>();
        for (const property of node.children ?? []) {
            const [keyNode] = property.children ?? [];
            if (!keyNode) continue;
            const key = String(keyNode.value);
            const earlier = seen.get(key);
            if (earlier) {
                duplicates.push({ key, first: earlier.keyNode, last: keyNode });
                hidden.add(earlier.property);
            }
            seen.set(key, { property, keyNode });
        }
    }
    for (const child of node.children ?? []) {
        if (!hidden.has(child)) findDuplicates(child, duplicates, hidden);
    }
}

export function members(
    node: Node,
    hidden: Set<Node>,
): { key: string; keyNode: Node; value: Node }[] {
    if (node.type !== "object") return [];
    const found: { key: string; keyNode: Node; value: Node }[] = [];
    for (const property of node.children ?? []) {
        const [keyNode, value] = property.children ?? [];
        if (hidden.has(property) || !keyNode || !value) continue;
        found.push({ key: String(keyNode.value), keyNode, value });
    }
    return found;
}

export function member(node: Node, key: string, hidden: Set<Node>): Node | undefined {
    return members(node, hidden).find((each) => each.key === key)?.value;
}

function findLineStarts(text: string): number[] {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code === 13 && text.charCodeAt(i + 1) === 10) i++;
        if (code === 10 || code === 13) starts.push(i + 1);
    }
    return starts;
}

export function spanOf(file: string, lineStarts: number[], offset: number, length: number): Span {
    return {
        file,
        offset,
        length,
        start: position(lineStarts, offset),
        end: position(lineStarts, offset + length),
    };
}

function position(lineStarts: number[], offset: number): { line: number; column: number } {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
        const middle = (low + high + 1) >> 1;
        if ((lineStarts[middle] ?? 0) <= offset) low = middle;
        else high = middle - 1;
    }
    return { line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
}

export function plainObject(node: Node, hidden: Set<Node>): Record<string, unknown> {
    return Object.fromEntries(
        members(node, hidden).map(({ key, value }) => [key, plainValue(value, hidden)]),
    );
}

export function plainValue(node: Node, hidden: Set<Node>): unknown {
    if (node.type === "object") return plainObject(node, hidden);
    if (node.type === "array")
        return (node.children ?? []).map((child) => plainValue(child, hidden));
    return node.value;
}
