import type { Span } from "../../src/index.js";

export type Locator =
    | { file: string; text: string; occurrence?: number }
    | { file: string; valueAfter: string; occurrence?: number };

export function isLocator(value: unknown): value is Locator {
    if (typeof value !== "object" || value === null) return false;
    return "file" in value && ("text" in value || "valueAfter" in value);
}

export function spanFor(files: Record<string, string>, locator: Locator): Span {
    const text = files[locator.file];
    if (text === undefined) throw new Error(`no input file ${locator.file}`);
    const needle = "text" in locator ? locator.text : locator.valueAfter;
    const found = nthIndex(text, needle, locator.occurrence ?? 1);
    if (found === -1) throw new Error(`${JSON.stringify(needle)} is not in ${locator.file}`);

    const offset = "text" in locator ? found : skipSpace(text, found + needle.length);
    const length = "text" in locator ? needle.length : valueLength(text, offset);
    return {
        file: locator.file,
        offset,
        length,
        start: lineAndColumn(text, offset),
        end: lineAndColumn(text, offset + length),
    };
}

function nthIndex(text: string, needle: string, occurrence: number): number {
    let index = -1;
    for (let count = 0; count < occurrence; count++) {
        index = text.indexOf(needle, index + 1);
        if (index === -1) return -1;
    }
    return index;
}

function skipSpace(text: string, from: number): number {
    let index = from;
    while (/\s/.test(text.charAt(index))) index++;
    return index;
}

function valueLength(text: string, start: number): number {
    const first = text.charAt(start);
    if (first === '"') return stringEnd(text, start) - start;
    if (first !== "{" && first !== "[") {
        let index = start;
        while (index < text.length && !/[\s,}\]]/.test(text.charAt(index))) index++;
        return index - start;
    }
    let depth = 0;
    let index = start;
    while (index < text.length) {
        const character = text.charAt(index);
        if (character === '"') {
            index = stringEnd(text, index);
            continue;
        }
        if (character === "{" || character === "[") depth++;
        if (character === "}" || character === "]") depth--;
        index++;
        if (depth === 0) return index - start;
    }
    throw new Error(`the value at ${start} is not closed`);
}

function stringEnd(text: string, start: number): number {
    let index = start + 1;
    while (text.charAt(index) !== '"') index += text.charAt(index) === "\\" ? 2 : 1;
    return index + 1;
}

function lineAndColumn(text: string, offset: number): { line: number; column: number } {
    const lines = text.slice(0, offset).split(/\r\n|\r|\n/);
    return { line: lines.length, column: (lines.at(-1) ?? "").length + 1 };
}

export function withSpans(value: unknown, files: Record<string, string>): unknown {
    if (isLocator(value)) return spanFor(files, value);
    if (Array.isArray(value)) return value.map((each) => withSpans(each, files));
    if (typeof value === "object" && value !== null) {
        return Object.fromEntries(
            Object.entries(value).map(([key, each]) => [key, withSpans(each, files)]),
        );
    }
    return value;
}
