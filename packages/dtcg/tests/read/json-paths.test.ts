import * as jsonc from "jsonc-parser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineGenerator, readFromMemory } from "../../src/index.js";

const number = (value: unknown) => ({ $type: "number", $value: value });

const steps = defineGenerator({
    extension: ["com.example", "steps"],
    messages: {},
    generate: () => ({ ok: true, value: [{ name: "a", $value: "{base}" }] }),
});

const tokens = readFromMemory(
    {
        files: {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    {
                        type: "set",
                        name: "base",
                        sources: [
                            { $ref: "tokens.json" },
                            { $ref: "part.json#/inner" },
                            { written: number(5) },
                        ],
                    },
                ],
            }),
            "tokens.json": JSON.stringify({
                base: number(1),
                color: { $type: "number", $root: { $value: 2 }, x: { $value: "{base}" } },
                g: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
                b: { $extends: "{color}" },
                pointer: number({ $ref: "#/base/$value" }),
                line: {
                    $type: "border",
                    $value: { color: "{base}", width: { value: 1, unit: "px" }, style: "solid" },
                },
            }),
            "part.json": JSON.stringify({ inner: { deep: number(3) } }),
        },
        entry: "tokens.resolver.json",
    },
    { generators: [steps] },
);
const read = tokens.permutation();
const placeOf = (path: string) => {
    const place = read.token(path)?.valueFrom;
    return place && tokens.jsonPathOf(place);
};

describe("where a place is in its file, as a JSON path", () => {
    it("is the token's member", () => {
        expect(placeOf("base")).toStrictEqual(["base"]);
        expect(placeOf("color.x")).toStrictEqual(["color", "x"]);
    });

    it("is its $root member for a root token", () => {
        expect(placeOf("color.$root")).toStrictEqual(["color", "$root"]);
    });

    it("is the member in the group it comes from, for a token a group inherits", () => {
        expect(placeOf("b.x")).toStrictEqual(["color", "x"]);
    });

    it("is the extension that makes a generated token", () => {
        expect(placeOf("g.a")).toStrictEqual(["g", "$extensions", "com.example", "steps"]);
    });

    it("starts at the top of the file, for a source that is part of one", () => {
        expect(placeOf("deep")).toStrictEqual(["inner", "deep"]);
    });

    it("is in the resolver, for a token written there", () => {
        expect(placeOf("written")).toStrictEqual(["resolutionOrder", 0, "sources", 2, "written"]);
    });

    it("is the group's member for a group, and none for the top of a file", () => {
        expect(
            read.group("color")?.writtenAt.map((place) => tokens.jsonPathOf(place)),
        ).toStrictEqual([["color"]]);
        expect(read.root.writtenAt.map((place) => tokens.jsonPathOf(place))).toStrictEqual([
            [],
            ["inner"],
            ["resolutionOrder", 0, "sources", 2],
        ]);
    });

    it("is on each place the design tokens give for a path", () => {
        expect(tokens.writtenAt("color.x").map(({ jsonPath }) => jsonPath)).toStrictEqual([
            ["color", "x"],
        ]);
    });
});

describe("where a reference is in its file, as a JSON path", () => {
    const referencesOf = (path: string) =>
        (read.token(path) ?? read.group(path))?.references.map((reference) =>
            tokens.jsonPathOf(reference),
        );

    it("is the value that writes it", () => {
        expect(referencesOf("color.x")).toStrictEqual([["color", "x", "$value"]]);
        expect(referencesOf("pointer")).toStrictEqual([["pointer", "$value"]]);
    });

    it("is the part that writes it, in a composite", () => {
        expect(referencesOf("line")).toStrictEqual([["line", "$value", "color"]]);
    });

    it("is a group's $extends", () => {
        expect(referencesOf("b")).toStrictEqual([["b", "$extends"]]);
    });

    it("is the extension that makes a generated token's reference", () => {
        expect(referencesOf("g.a")).toStrictEqual([["g", "$extensions", "com.example", "steps"]]);
    });

    it("is on each reference the design tokens give for a path, an inherited one where it is written", () => {
        expect(
            tokens.referencedBy("base").map(({ from, jsonPath }) => [from, jsonPath]),
        ).toStrictEqual([
            ["color.x", ["color", "x", "$value"]],
            ["b.x", ["color", "x", "$value"]],
            ["g.a", ["g", "$extensions", "com.example", "steps"]],
            ["pointer", ["pointer", "$value"]],
            ["line", ["line", "$value", "color"]],
        ]);
    });
});

describe("asking for a JSON path", () => {
    it("is refused for a place from a read of other text, which writes nothing there", () => {
        const other = readFromMemory({
            files: { "tokens.json": JSON.stringify({ gap: number(9) }) },
        });
        const place = other.permutation().token("gap")?.valueFrom;
        const elsewhere = readFromMemory({ files: { "tokens.json": "{}" } });

        expect(() => place && elsewhere.jsonPathOf(place)).toThrow(
            "nothing is written at that place in `tokens.json` in this read",
        );
    });
});

describe("a JSON path after a reread", () => {
    it("is still where the place is, when text above it changed", () => {
        const text = JSON.stringify({ base: number(1), gap: number(2) }, null, 2);
        const before = readFromMemory({ files: { "t.json": text } });
        const after = before.reread({
            "t.json": text.replace(
                '"base"',
                '"aaaa": { "$type": "number", "$value": 0 },\n  "base"',
            ),
        });
        const kept = after.permutation().token("gap");

        expect(kept?.valueFrom).toBe(before.permutation().token("gap")?.valueFrom);
        expect(kept && after.jsonPathOf(kept.valueFrom)).toStrictEqual(["gap"]);
    });
});

describe("what a file writes at a JSON path", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("is the JSON written there, exactly as written", () => {
        expect(tokens.jsonAt("tokens.json", ["color", "x"])).toStrictEqual({ $value: "{base}" });
        expect(tokens.jsonAt("tokens.json", ["color", "x", "$value"])).toBe("{base}");
        expect(tokens.jsonAt("tokens.json", [])).toMatchObject({ base: number(1) });
    });

    it("is undefined where the file writes nothing, or the read has no such file", () => {
        expect(tokens.jsonAt("tokens.json", ["color", "nope"])).toBeUndefined();
        expect(tokens.jsonAt("nope.json", ["base"])).toBeUndefined();
    });

    it("is the text this read holds, after a reread", () => {
        const before = readFromMemory({ files: { "t.json": JSON.stringify({ gap: number(1) }) } });
        const after = before.reread({ "t.json": JSON.stringify({ gap: number(2) }) });

        expect(before.jsonAt("t.json", ["gap", "$value"])).toBe(1);
        expect(after.jsonAt("t.json", ["gap", "$value"])).toBe(2);
    });

    it("reads a file's text once for both questions", () => {
        const small = readFromMemory({ files: { "t.json": JSON.stringify({ gap: number(1) }) } });
        const place = small.permutation().token("gap")?.valueFrom;
        const parses = vi.spyOn(jsonc, "parseTree");

        if (place) small.jsonPathOf(place);
        small.jsonAt("t.json", ["gap"]);
        small.jsonAt("t.json", ["gap", "$value"]);

        expect(parses).toHaveBeenCalledTimes(1);
    });
});
