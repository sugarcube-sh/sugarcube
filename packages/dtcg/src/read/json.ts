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

export type ParsedJson =
    | { ok: true; file: JsonFile; comments: JsonProblem[]; duplicates: DuplicateKey[] }
    | { ok: false; lineStarts: number[]; problems: JsonProblem[] };

const reasons: Record<string, JsonErrorReason> = {
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

export function parseJson(path: string, text: string): ParsedJson {
    const source = text.startsWith("\uFEFF") ? ` ${text.slice(1)}` : text;
    const lineStarts = findLineStarts(source);
    const errors: { error: number; offset: number; length: number }[] = [];
    const root = parseTree(source, errors, { disallowComments: true });

    const comments: JsonProblem[] = [];
    let syntax: JsonProblem | undefined;
    for (const { error, offset, length } of errors) {
        const reason = reasons[printParseErrorCode(error)] ?? "invalid-symbol";
        if (reason === "comment") comments.push({ reason, offset, length });
        else syntax ??= { reason, offset, length };
    }

    if (syntax || !root) {
        const problems = [
            ...comments,
            syntax ?? { reason: "value-expected", offset: 0, length: 0 },
        ];
        return { ok: false, lineStarts, problems: problems.sort((a, b) => a.offset - b.offset) };
    }
    if (root.type !== "object") {
        return {
            ok: false,
            lineStarts,
            problems: [{ reason: "not-an-object", offset: root.offset, length: root.length }],
        };
    }

    const duplicates: DuplicateKey[] = [];
    const hidden = new Set<Node>();
    findDuplicates(root, duplicates, hidden);
    return { ok: true, file: { path, root, lineStarts, hidden }, comments, duplicates };
}

function findDuplicates(node: Node, duplicates: DuplicateKey[], hidden: Set<Node>): void {
    if (node.type === "object") {
        const seen = new Map<string, Node>();
        for (const property of node.children ?? []) {
            const key = property.children?.[0]?.value as string;
            const earlier = seen.get(key);
            if (earlier) {
                duplicates.push({ key, first: earlier, last: property });
                hidden.add(earlier);
            }
            seen.set(key, property);
        }
    }
    for (const child of node.children ?? []) {
        if (!hidden.has(child)) findDuplicates(child, duplicates, hidden);
    }
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
