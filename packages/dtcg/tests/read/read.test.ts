import { describe, expect, it, vi } from "vitest";
import { type ReadOptions, read, readFromMemory } from "../../src/index.js";

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
                    '{ "a": { "$type": "number", "b": { "$value": 1 }, "b": { "$value": 2 }, "b": { "$value": 3 } } }',
            },
        });
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "duplicate-key", detail: { key: "b" } },
            { kind: "duplicate-key", detail: { key: "b" } },
        ]);
    });
});

describe("what is set aside is a warning, and what cannot be read an error", () => {
    const severities = (text: string, options: ReadOptions = {}) =>
        readFromMemory({ files: { "tokens.json": text } }, options).diagnostics.map(
            ({ kind, severity, detail }) => [
                kind,
                severity,
                "property" in detail ? detail.property : "",
            ],
        );

    it("a key written twice, a description, deprecation or extensions of the wrong kind, and an unknown property in a value are warnings", () => {
        const text = `{
            "a": { "$type": "number", "$value": 1 },
            "a": { "$type": "number", "$value": 2, "$description": 5 },
            "b": { "$type": "number", "$value": 1, "$deprecated": 1, "$extensions": [] },
            "c": { "$type": "dimension", "$value": { "value": 1, "unit": "px", "fluid": true } }
        }`;
        expect(severities(text, { ignoreUnknownProperties: true })).toStrictEqual([
            ["duplicate-key", "warning", ""],
            ["invalid-property", "warning", "$description"],
            ["invalid-property", "warning", "$deprecated"],
            ["invalid-property", "warning", "$extensions"],
            ["unknown-property", "warning", "fluid"],
        ]);
    });

    it("a pointer without its slash is an error in a reference to another file, as in a token file", () => {
        const doc = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "all.json#space" }] },
                    ],
                }),
                "all.json": JSON.stringify({
                    space: { $type: "number", one: { $value: 1 }, two: { $ref: "#space/one" } },
                }),
            },
            entry: "tokens.resolver.json",
        });
        expect(doc.diagnostics.map(({ kind, severity }) => [kind, severity])).toStrictEqual([
            ["malformed-pointer", "error"],
        ]);
        expect(doc.permutations[0]?.tokens).toStrictEqual([]);
    });

    it("a $type, $extends or $ref of the wrong kind stays an error, since it changes what the token is", () => {
        const text = `{
            "a": { "$type": 5, "$value": 1 },
            "g": { "$extends": 5 },
            "h": { "$ref": 5 }
        }`;
        expect(severities(text).filter(([kind]) => kind === "invalid-property")).toStrictEqual([
            ["invalid-property", "error", "$type"],
            ["invalid-property", "error", "$extends"],
            ["invalid-property", "error", "$ref"],
        ]);
    });
});

describe("read", () => {
    it("asks for each file by the entry's folder, and keeps paths relative to it", async () => {
        const readText = vi.fn(async () => valid);
        const doc = await read("tokens/base.json", { readText });
        expect(readText.mock.calls).toStrictEqual([["tokens/base.json"]]);
        expect(doc.files).toStrictEqual(["base.json"]);
        expect(doc.permutations[0]?.sources).toStrictEqual([{ file: "base.json" }]);
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

describe("paths in a resolver", () => {
    const resolver = JSON.stringify({
        version: "2025.10",
        sets: {
            base: {
                sources: [
                    { $ref: "dark.json" },
                    { $ref: "./dark.json" },
                    { $ref: "../shared/base.json" },
                    { $ref: "https://cdn.example.com/tokens.json" },
                    { $ref: "C:/tokens/windows.json" },
                ],
            },
        },
        resolutionOrder: [{ $ref: "#/sets/base" }],
    });

    it("asks for every file a resolver names in one batch, each once, joined onto the entry's folder", async () => {
        const batches: string[][] = [];
        let batch: string[] = [];
        const readText = async (path: string) => {
            batch.push(path);
            await Promise.resolve();
            if (batch.length > 0) batches.push(batch);
            batch = [];
            return path.endsWith(".resolver.json") ? resolver : valid;
        };
        const doc = await read("tokens/design.resolver.json", { readText });

        expect(batches).toStrictEqual([
            ["tokens/design.resolver.json"],
            [
                "tokens/dark.json",
                "shared/base.json",
                "https://cdn.example.com/tokens.json",
                "C:/tokens/windows.json",
            ],
        ]);
        expect(doc.files).toStrictEqual([
            "design.resolver.json",
            "dark.json",
            "../shared/base.json",
            "https://cdn.example.com/tokens.json",
            "C:/tokens/windows.json",
        ]);
        expect(doc.diagnostics).toStrictEqual([]);
    });
});

describe("shared sets", () => {
    it("reports a problem in a set once, however many places use it", () => {
        const doc = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    sets: {
                        palette: { sources: [{ $ref: "#/nowhere" }] },
                        light: { sources: [{ $ref: "#/sets/palette" }] },
                        dark: { sources: [{ $ref: "#/sets/palette" }] },
                    },
                    modifiers: {
                        theme: {
                            contexts: {
                                light: [{ $ref: "#/sets/palette" }],
                                dark: [{ $ref: "#/sets/palette" }],
                            },
                        },
                    },
                    resolutionOrder: [
                        { $ref: "#/sets/light" },
                        { $ref: "#/sets/dark" },
                        { $ref: "#/modifiers/theme" },
                    ],
                }),
            },
        });
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            {
                kind: "resolver-invalid",
                detail: {
                    rule: "invalid-pointer",
                    name: "#/nowhere",
                    at: ["sets", "palette", "sources", 0, "$ref"],
                },
            },
        ]);
    });
});

describe("the combination limit", () => {
    const withModifiers = (count: number, defaults = true) =>
        JSON.stringify({
            version: "2025.10",
            modifiers: Object.fromEntries(
                Array.from({ length: count }, (_, i) => [
                    `m${i}`,
                    { contexts: { off: [], on: [] }, ...(defaults && { default: "off" }) },
                ]),
            ),
            resolutionOrder: Array.from({ length: count }, (_, i) => ({
                $ref: `#/modifiers/m${i}`,
            })),
        });
    const readWith = (resolver: string, options: { permutationLimit?: number } = {}) =>
        readFromMemory({ files: { "tokens.resolver.json": resolver } }, options);

    it("builds every combination up to the limit, and no warning", () => {
        const doc = readWith(withModifiers(5));
        expect(doc.permutations).toHaveLength(32);
        expect(doc.diagnostics).toStrictEqual([]);
    });

    it("builds the default and each context on its own above it, and says so", () => {
        const doc = readWith(withModifiers(6));
        expect(doc.permutations.map(({ label }) => label)).toStrictEqual([
            "default",
            "m0: on",
            "m1: on",
            "m2: on",
            "m3: on",
            "m4: on",
            "m5: on",
        ]);
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "permutation-limit", detail: { count: 64, limit: 32, built: 7 } },
        ]);
    });

    it("takes a higher limit", () => {
        const doc = readWith(withModifiers(6), { permutationLimit: 64 });
        expect(doc.permutations).toHaveLength(64);
        expect(doc.diagnostics).toStrictEqual([]);
    });

    it("builds only what can be built above it when modifiers have no default", () => {
        const doc = readWith(withModifiers(6, false));
        expect(doc.permutations).toStrictEqual([]);
        expect(doc.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            {
                kind: "no-default",
                detail: { modifiers: ["m0", "m1", "m2", "m3", "m4", "m5"] },
            },
            { kind: "permutation-limit", detail: { count: 64, limit: 32, built: 0 } },
        ]);
    });

    it("never needs the limit when inputs are given", () => {
        const doc = readFromMemory(
            { files: { "tokens.resolver.json": withModifiers(20) } },
            { inputs: [{ m3: "on" }] },
        );
        expect(doc.permutations.map(({ label }) => label)).toStrictEqual(["m3: on"]);
        expect(doc.diagnostics).toStrictEqual([]);
    });
});

describe("each context on its own", () => {
    const resolver = (modifiers: Record<string, unknown>) =>
        JSON.stringify({
            version: "2025.10",
            modifiers,
            resolutionOrder: Object.keys(modifiers).map((name) => ({
                $ref: `#/modifiers/${name}`,
            })),
        });
    const labels = (text: string) => {
        const doc = readFromMemory(
            { files: { "tokens.resolver.json": text } },
            { permutations: "each-context" },
        );
        return {
            labels: doc.permutations.map(({ label }) => label),
            diagnostics: doc.diagnostics.map(({ kind, detail }) => ({ kind, detail })),
        };
    };

    it("builds the default, then each context with the other modifiers at their defaults", () => {
        expect(
            labels(
                resolver({
                    theme: { contexts: { light: [], dark: [], dim: [] }, default: "light" },
                    brand: { contexts: { house: [], ocean: [] }, default: "house" },
                }),
            ),
        ).toStrictEqual({ labels: ["default", "dark", "dim", "ocean"], diagnostics: [] });
    });

    it("builds each context of the one modifier with no default, and says what it could not build", () => {
        expect(
            labels(
                resolver({
                    size: { contexts: { small: [], large: [] } },
                    brand: { contexts: { house: [], ocean: [] }, default: "house" },
                }),
            ),
        ).toStrictEqual({
            labels: ["small", "large"],
            diagnostics: [{ kind: "no-default", detail: { modifiers: ["size"] } }],
        });
    });

    it("points at the modifier with no default", () => {
        const text = resolver({
            size: { contexts: { small: [], large: [] } },
            brand: { contexts: { house: [], ocean: [] }, default: "house" },
        });
        const [found] = readFromMemory(
            { files: { "tokens.resolver.json": text } },
            { permutations: "each-context" },
        ).diagnostics;
        expect(found?.at && text.slice(found.at.offset, found.at.offset + found.at.length)).toBe(
            '{"contexts":{"small":[],"large":[]}}',
        );
        expect(found?.fixes).toBeUndefined();
    });
});

describe("inputs without modifiers", () => {
    it("builds the one permutation there is, since there is nothing to check (Resolver 6.1)", () => {
        const doc = readFromMemory(
            { files: { "tokens.json": valid } },
            { inputs: [{ theme: "dark" }] },
        );
        expect(doc.permutations.map(({ input, label }) => ({ input, label }))).toStrictEqual([
            { input: {}, label: "default" },
        ]);
        expect(doc.diagnostics).toStrictEqual([]);
    });
});

describe("readFromMemory", () => {
    it("reads several files with no resolver as one set, in the order given", () => {
        const doc = readFromMemory({ files: { "base.json": valid, "./themes/dark.json": valid } });
        expect(doc.files).toStrictEqual(["base.json", "themes/dark.json"]);
        expect(doc.usedBy).toStrictEqual({
            "base.json": "everyone",
            "themes/dark.json": "everyone",
        });
        expect(
            doc.permutations.map(({ input, label, sources }) => ({ input, label, sources })),
        ).toStrictEqual([
            {
                input: {},
                label: "default",
                sources: [{ file: "base.json" }, { file: "themes/dark.json" }],
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

describe("a group referring to the whole document", () => {
    it("is circular, as the document holds the group, and names the top level", () => {
        const files = { "tokens.json": JSON.stringify({ g: { $ref: "#" } }) };
        const found = readFromMemory({ files }).diagnostics.map(({ kind, detail, message }) => ({
            kind,
            detail,
            message,
        }));
        expect(found).toStrictEqual([
            {
                kind: "circular-reference",
                detail: { chain: ["g", ""] },
                message: "these references lead back to where they started: g → the top level",
            },
        ]);
    });
});
