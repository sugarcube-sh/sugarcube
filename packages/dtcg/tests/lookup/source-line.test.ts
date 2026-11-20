import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { getSourceLine } from "../../src/editor.js";

const text = `{
  "space": {
    "sm": { "$type": "dimension", "$value": "0.25rem" }
  }
}`;

const read = (fileText: string) => readFromMemory({ files: { "tokens.json": fileText } });

describe("getSourceLine", () => {
    it("stops a span over several lines at the end of its first", () => {
        const span = {
            file: "tokens.json",
            offset: text.indexOf("{", 1),
            length: text.lastIndexOf("}") - text.indexOf("{", 1),
            start: { line: 2, column: 12 },
            end: { line: 4, column: 4 },
        };
        expect(getSourceLine(read(text), span)).toStrictEqual({
            line: 2,
            text: '  "space": {',
            column: 12,
            length: 1,
        });
    });

    it("marks one character for an empty span", () => {
        const span = {
            file: "tokens.json",
            offset: 0,
            length: 0,
            start: { line: 1, column: 1 },
            end: { line: 1, column: 1 },
        };
        expect(getSourceLine(read(text), span)).toMatchObject({ line: 1, text: "{", length: 1 });
    });

    it("reads lines ended by CRLF", () => {
        const crlf = text.replaceAll("\n", "\r\n");
        const span = {
            file: "tokens.json",
            offset: crlf.indexOf('"space"'),
            length: '"space"'.length,
            start: { line: 2, column: 3 },
            end: { line: 2, column: 10 },
        };
        expect(getSourceLine(read(crlf), span)).toStrictEqual({
            line: 2,
            text: '  "space": {',
            column: 3,
            length: 7,
        });
    });

    it("is undefined for a file the read has no text for", () => {
        const span = {
            file: "other.json",
            offset: 0,
            length: 1,
            start: { line: 1, column: 1 },
            end: { line: 1, column: 2 },
        };
        expect(getSourceLine(read(text), span)).toBe(undefined);
    });
});
