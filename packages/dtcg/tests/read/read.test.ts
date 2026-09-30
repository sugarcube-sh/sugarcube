import { describe, expect, it, vi } from "vitest";
import { read, readFromMemory } from "../../src/index.js";

const valid = '{ "a": { "$type": "number", "$value": 1 } }';

function where(text: string) {
    const [first] = readFromMemory({ files: { "tokens.json": text } }).diagnostics;
    return first?.at && { offset: first.at.offset, start: first.at.start, end: first.at.end };
}

describe("positions", () => {
    it("counts columns in UTF-16 units, so a character outside the Basic Multilingual Plane is two", () => {
        expect(where('{ "🎨": 1, }')).toStrictEqual({
            offset: 11,
            start: { line: 1, column: 12 },
            end: { line: 1, column: 13 },
        });
    });

    it.for([
        ["\n", "a line feed"],
        ["\r\n", "a carriage return and line feed"],
        ["\r", "a carriage return alone"],
    ])("ends a line at %j, %s", ([newline]) => {
        const text = `{${newline}  "a": 1,${newline}}`;
        expect(where(text)).toStrictEqual({
            offset: text.lastIndexOf("}"),
            start: { line: 3, column: 1 },
            end: { line: 3, column: 2 },
        });
    });

    it("ignores a byte order mark, and still counts it in offsets", () => {
        expect(
            readFromMemory({ files: { "tokens.json": `\uFEFF${valid}` } }).diagnostics,
        ).toStrictEqual([]);
        expect(where('\uFEFF{ "a": 1, }')).toStrictEqual({
            offset: 11,
            start: { line: 1, column: 12 },
            end: { line: 1, column: 13 },
        });
    });

    it("reports a comment and a syntax error in the same file, in file order", () => {
        const doc = readFromMemory({ files: { "tokens.json": '{ "a": 1, // note\n }' } });
        expect(doc.diagnostics.map(({ detail }) => detail)).toStrictEqual([
            { reason: "comment" },
            { reason: "property-name-expected" },
        ]);
    });

    it("reports only the first syntax error, since later ones usually follow from it", () => {
        const doc = readFromMemory({ files: { "tokens.json": '{ "a": 1,, "b": }' } });
        expect(doc.diagnostics.map(({ detail }) => detail)).toStrictEqual([
            { reason: "property-name-expected" },
        ]);
    });

    it("reports each repeat of a key, in a nested object too", () => {
        const doc = readFromMemory({
            files: {
                "tokens.json":
                    '{ "a": { "b": { "$value": 1 }, "b": { "$value": 2 }, "b": { "$value": 3 } } }',
            },
        });
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "duplicate-key", detail: { key: "b" } },
            { kind: "duplicate-key", detail: { key: "b" } },
        ]);
    });
});

describe("read", () => {
    it("asks for each file by the entry's folder, and keeps paths relative to it", async () => {
        const readText = vi.fn(async () => valid);
        const doc = await read("tokens/base.json", { readText });
        expect(readText.mock.calls).toStrictEqual([["tokens/base.json"]]);
        expect(doc.files).toStrictEqual(["base.json"]);
        expect(doc.permutations[0]?.sets).toStrictEqual([
            { file: "base.json", from: { set: "default" } },
        ]);
    });

    it("tidies the entry's folder", async () => {
        const readText = vi.fn(async () => valid);
        await read("./tokens/../design/base.json", { readText });
        expect(readText.mock.calls).toStrictEqual([["design/base.json"]]);
    });

    it("reports a file as not found when readText throws before returning a promise", async () => {
        const doc = await read("tokens.json", {
            readText: () => {
                throw new Error("no");
            },
        });
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "file-not-found", detail: { file: "tokens.json" } },
        ]);
    });

    it("reports the time the load took", async () => {
        const onStage = vi.fn();
        await read("tokens.json", { readText: async () => valid, onStage });
        expect(onStage).toHaveBeenCalledWith("load", expect.any(Number));
    });
});

describe("readFromMemory", () => {
    it("reads several files with no resolver as one set, in the order given", () => {
        const doc = readFromMemory({ files: { "base.json": valid, "./themes/dark.json": valid } });
        expect(doc.files).toStrictEqual(["base.json", "themes/dark.json"]);
        expect(doc.readers).toStrictEqual({
            "base.json": "everyone",
            "themes/dark.json": "everyone",
        });
        expect(
            doc.permutations.map(({ input, label, sets }) => ({ input, label, sets })),
        ).toStrictEqual([
            {
                input: {},
                label: "default",
                sets: [
                    { file: "base.json", from: { set: "default" } },
                    { file: "themes/dark.json", from: { set: "default" } },
                ],
            },
        ]);
        expect(doc.diagnostics).toStrictEqual([]);
    });

    it("finds an entry given with a folder among the files", () => {
        const doc = readFromMemory({
            files: { "tokens/base.json": valid, "other.json": valid },
            entry: "tokens/base.json",
        });
        expect(doc.files).toStrictEqual(["base.json"]);
        expect(doc.diagnostics).toStrictEqual([]);
    });

    it("uses a resolver among the files as the entry, and ignores files it does not read", () => {
        const doc = readFromMemory({
            files: {
                "stray.json": "{ // not read\n }",
                "design.resolver.json": '{ "version": "2025.10", "resolutionOrder": [] }',
            },
        });
        expect(doc.files).toStrictEqual(["design.resolver.json"]);
        expect(doc.diagnostics).toStrictEqual([]);
    });

    it("reports a syntax error in a resolver, but not its comments", () => {
        const doc = readFromMemory({
            files: {
                "design.resolver.json":
                    '{ // fine here\n "version": "2025.10", "resolutionOrder": [], }',
            },
        });
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "invalid-json", detail: { reason: "property-name-expected" } },
        ]);
    });

    it("returns plain data", () => {
        const doc = readFromMemory({ files: { "tokens.json": '{ "a": 1, "a": 2 }' } });
        expect(JSON.parse(JSON.stringify(doc))).toStrictEqual(doc);
    });
});
