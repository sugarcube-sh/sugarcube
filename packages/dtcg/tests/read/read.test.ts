import { describe, expect, it, vi } from "vitest";
import {
    type ReadOptions,
    defineExtensionValidator,
    defineGenerator,
    filePath,
    read,
    readFromMemory,
} from "../../src/index.js";

const valid = '{ "a": { "$type": "number", "$value": 1 } }';

function where(text: string) {
    const [first] = readFromMemory({ files: { "tokens.json": text } }).diagnostics;
    return (
        first?.span && { offset: first.span.offset, start: first.span.start, end: first.span.end }
    );
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
        const tokens = readFromMemory({ files: { "tokens.json": '{ "a": 1, // note\n }' } });
        expect(tokens.diagnostics.map(({ detail }) => detail)).toStrictEqual([
            { reason: "comment" },
            { reason: "property-name-expected" },
        ]);
    });

    it("reports only the first syntax error, since later ones usually follow from it", () => {
        const tokens = readFromMemory({ files: { "tokens.json": '{ "a": 1,, "b": }' } });
        expect(tokens.diagnostics.map(({ detail }) => detail)).toStrictEqual([
            { reason: "property-name-expected" },
        ]);
    });

    it("reports each repeat of a key, in a nested object too", () => {
        const tokens = readFromMemory({
            files: {
                "tokens.json":
                    '{ "a": { "$type": "number", "b": { "$value": 1 }, "b": { "$value": 2 }, "b": { "$value": 3 } } }',
            },
        });
        expect(tokens.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
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
        const tokens = readFromMemory({
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
        expect(tokens.diagnostics.map(({ kind, severity }) => [kind, severity])).toStrictEqual([
            ["malformed-pointer", "error"],
        ]);
        expect(tokens.permutations[0]?.tokens).toStrictEqual([]);
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

describe("the options design tokens were read with", () => {
    it("are recorded, so its values can be read again the same way", () => {
        const options = { hexStringColors: true, ignoreUnknownProperties: true };
        const tokens = readFromMemory({ files: { "tokens.json": valid } }, options);
        expect(tokens.parseOptions).toStrictEqual(options);
    });

    it("are the defaults when none are given", () => {
        const tokens = readFromMemory({ files: { "tokens.json": valid } });
        expect(tokens.parseOptions).toStrictEqual({
            hexStringColors: false,
            ignoreUnknownProperties: false,
        });
    });
});

describe("read", () => {
    it("asks for each file by the entry's folder, and keeps paths relative to it", async () => {
        const readText = vi.fn(async () => valid);
        const tokens = await read("tokens/base.json", { readText });
        expect(readText.mock.calls).toStrictEqual([["tokens/base.json", "base.json"]]);
        expect(tokens.files).toStrictEqual(["base.json"]);
        expect(tokens.permutations[0]?.sources).toEqual([
            { file: "base.json", sets: [], readBy: "everyone" },
        ]);
    });

    it("tidies the entry's folder", async () => {
        const readText = vi.fn(async () => valid);
        await read("./tokens/../design/base.json", { readText });
        expect(readText.mock.calls).toStrictEqual([["design/base.json", "base.json"]]);
    });

    it("reports a file as not found when readText gives undefined", async () => {
        const tokens = await read("tokens.json", { readText: async () => undefined });
        expect(tokens.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "file-not-found", detail: { file: "tokens.json" } },
        ]);
    });

    it("rejects, naming the file, when readText rejects", async () => {
        const offline = new Error("offline");
        const reading = read("tokens/tokens.json", {
            readText: () => Promise.reject(offline),
        });
        await expect(reading).rejects.toThrow("tokens/tokens.json");
        await expect(reading).rejects.toMatchObject({ cause: offline });
    });

    it("rejects when readText throws before returning a promise", async () => {
        const reading = read("tokens.json", {
            readText: () => {
                throw new Error("no");
            },
        });
        await expect(reading).rejects.toThrow("tokens.json");
    });

    it("rejects when a file the resolver names cannot be read, not only the entry", async () => {
        const resolver = JSON.stringify({
            version: "2025.10",
            sets: { base: { sources: [{ $ref: "base.json" }] } },
            resolutionOrder: [{ $ref: "#/sets/base" }],
        });
        const reading = read("tokens.resolver.json", {
            readText: async (path) =>
                path === "base.json" ? Promise.reject(new Error("503")) : resolver,
        });
        await expect(reading).rejects.toThrow("base.json");
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
        const tokens = await read("tokens/design.resolver.json", { readText });

        expect(batches).toStrictEqual([
            ["tokens/design.resolver.json"],
            [
                "tokens/dark.json",
                "shared/base.json",
                "https://cdn.example.com/tokens.json",
                "C:/tokens/windows.json",
            ],
        ]);
        expect(tokens.files).toStrictEqual([
            "design.resolver.json",
            "dark.json",
            "../shared/base.json",
            "https://cdn.example.com/tokens.json",
            "C:/tokens/windows.json",
        ]);
        expect(tokens.diagnostics).toStrictEqual([]);
    });

    it("names each file it asks for as the design tokens will name it", async () => {
        const asked: [string, string][] = [];
        await read("tokens/design.resolver.json", {
            readText: async (path, file) => {
                asked.push([path, file]);
                return path.endsWith(".resolver.json") ? resolver : valid;
            },
        });
        expect(asked).toStrictEqual([
            ["tokens/design.resolver.json", "design.resolver.json"],
            ["tokens/dark.json", "dark.json"],
            ["shared/base.json", "../shared/base.json"],
            ["https://cdn.example.com/tokens.json", "https://cdn.example.com/tokens.json"],
            ["C:/tokens/windows.json", "C:/tokens/windows.json"],
        ]);
    });

    it("gives back, through filePath, the path it asked for each file the design tokens name", async () => {
        const asked: [string, string][] = [];
        await read("tokens/design.resolver.json", {
            readText: async (path, file) => {
                asked.push([path, file]);
                return path.endsWith(".resolver.json") ? resolver : valid;
            },
        });
        expect(
            asked.map(([, file]) => filePath("tokens/design.resolver.json", file)),
        ).toStrictEqual(asked.map(([path]) => path));
    });

    it("finds a file by the entry's folder, a file nothing has read yet included", () => {
        expect(filePath("tokens/tokens.resolver.json", "themes/new.json")).toBe(
            "tokens/themes/new.json",
        );
        expect(filePath("tokens.resolver.json", "dark.json")).toBe("dark.json");
    });

    it("leaves a file named from the root as written", () => {
        expect(filePath("/project/tokens/tokens.resolver.json", "/shared/brand.json")).toBe(
            "/shared/brand.json",
        );
    });
});

describe("shared sets", () => {
    it("reports a problem in a set once, however many places use it", () => {
        const tokens = readFromMemory({
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
        expect(tokens.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            {
                kind: "resolver-invalid",
                detail: {
                    rule: "invalid-pointer",
                    name: "#/nowhere",
                    jsonPath: ["sets", "palette", "sources", 0, "$ref"],
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

    it("lists every combination in the resolver's order, the first modifier changing slowest", () => {
        const resolver = JSON.stringify({
            version: "2025.10",
            modifiers: {
                theme: { contexts: { dark: [], light: [] }, default: "light" },
                density: { contexts: { compact: [], comfy: [] }, default: "comfy" },
            },
            resolutionOrder: [{ $ref: "#/modifiers/theme" }, { $ref: "#/modifiers/density" }],
        });
        expect(readWith(resolver).permutations.inputs).toStrictEqual([
            { theme: "dark", density: "compact" },
            { theme: "dark", density: "comfy" },
            { theme: "light", density: "compact" },
            { theme: "light", density: "comfy" },
        ]);
    });

    it("builds every combination up to the limit, and no warning", () => {
        const tokens = readWith(withModifiers(5));
        expect(tokens.permutations).toHaveLength(32);
        expect(tokens.diagnostics).toStrictEqual([]);
    });

    it("builds each context on its own above it, and says so", () => {
        const tokens = readWith(withModifiers(6));
        expect(tokens.permutations.map(({ input }) => Object.values(input).join(""))).toStrictEqual(
            [
                "offoffoffoffoffoff",
                "onoffoffoffoffoff",
                "offonoffoffoffoff",
                "offoffonoffoffoff",
                "offoffoffonoffoff",
                "offoffoffoffonoff",
                "offoffoffoffoffon",
            ],
        );
        expect(tokens.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "permutation-limit", detail: { count: 64, limit: 32, built: 7 } },
        ]);
    });

    it("takes a higher limit", () => {
        const tokens = readWith(withModifiers(6), { permutationLimit: 64 });
        expect(tokens.permutations).toHaveLength(64);
        expect(tokens.diagnostics).toStrictEqual([]);
    });

    it("builds every combination above it when no modifier has a default, and says so", () => {
        const tokens = readWith(withModifiers(6, false));
        expect(tokens.permutations).toHaveLength(64);
        expect(tokens.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "permutation-limit", detail: { count: 64, limit: 32, built: 64 } },
        ]);
    });

    it("never needs the limit when inputs are given", () => {
        const tokens = readFromMemory(
            { files: { "tokens.resolver.json": withModifiers(20) } },
            { inputs: [{ m3: "on" }] },
        );
        expect(tokens.permutations.map(({ input }) => input.m3)).toStrictEqual(["on"]);
        expect(tokens.diagnostics).toStrictEqual([]);
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
    const built = (text: string) => {
        const tokens = readFromMemory(
            { files: { "tokens.resolver.json": text } },
            { permutations: "each-context" },
        );
        return {
            inputs: tokens.permutations.inputs,
            diagnostics: tokens.diagnostics.map(({ kind, detail }) => ({ kind, detail })),
        };
    };

    it("builds the default, then each context with the other modifiers at their defaults", () => {
        expect(
            built(
                resolver({
                    theme: { contexts: { light: [], dark: [], dim: [] }, default: "light" },
                    brand: { contexts: { house: [], ocean: [] }, default: "house" },
                }),
            ),
        ).toStrictEqual({
            inputs: [
                { theme: "light", brand: "house" },
                { theme: "dark", brand: "house" },
                { theme: "dim", brand: "house" },
                { theme: "light", brand: "ocean" },
            ],
            diagnostics: [],
        });
    });

    it("lists them in the resolver's order, the default where its contexts are written", () => {
        expect(
            built(
                resolver({
                    theme: { contexts: { dark: [], light: [], dim: [] }, default: "light" },
                    brand: { contexts: { ocean: [], house: [] }, default: "house" },
                }),
            ).inputs,
        ).toStrictEqual([
            { theme: "dark", brand: "house" },
            { theme: "light", brand: "house" },
            { theme: "dim", brand: "house" },
            { theme: "light", brand: "ocean" },
        ]);
    });

    it("builds the other modifiers' contexts with each context of a modifier with no default", () => {
        expect(
            built(
                resolver({
                    size: { contexts: { small: [], large: [] } },
                    brand: { contexts: { house: [], ocean: [] }, default: "house" },
                }),
            ),
        ).toStrictEqual({
            inputs: [
                { size: "small", brand: "house" },
                { size: "large", brand: "house" },
                { size: "small", brand: "ocean" },
                { size: "large", brand: "ocean" },
            ],
            diagnostics: [],
        });
    });

    it("builds each context of the only modifier, which has no default", () => {
        expect(built(resolver({ theme: { contexts: { light: [], dark: [] } } }))).toStrictEqual({
            inputs: [{ theme: "light" }, { theme: "dark" }],
            diagnostics: [],
        });
    });

    it("builds the others' contexts with every combination of the modifiers with no default", () => {
        expect(
            built(
                resolver({
                    size: { contexts: { small: [], large: [] } },
                    theme: { contexts: { light: [], dark: [] } },
                    brand: { contexts: { house: [], ocean: [] }, default: "house" },
                    density: { contexts: { regular: [], compact: [] }, default: "regular" },
                }),
            ),
        ).toStrictEqual({
            inputs: [
                { size: "small", theme: "light", brand: "house", density: "regular" },
                { size: "large", theme: "light", brand: "house", density: "regular" },
                { size: "small", theme: "dark", brand: "house", density: "regular" },
                { size: "large", theme: "dark", brand: "house", density: "regular" },
                { size: "small", theme: "light", brand: "ocean", density: "regular" },
                { size: "small", theme: "dark", brand: "ocean", density: "regular" },
                { size: "large", theme: "light", brand: "ocean", density: "regular" },
                { size: "large", theme: "dark", brand: "ocean", density: "regular" },
                { size: "small", theme: "light", brand: "house", density: "compact" },
                { size: "small", theme: "dark", brand: "house", density: "compact" },
                { size: "large", theme: "light", brand: "house", density: "compact" },
                { size: "large", theme: "dark", brand: "house", density: "compact" },
            ],
            diagnostics: [],
        });
    });
});

describe("inputs without modifiers", () => {
    it("builds the one permutation there is, since there is nothing to check (Resolver 6.1)", () => {
        const tokens = readFromMemory(
            { files: { "tokens.json": valid } },
            { inputs: [{ theme: "dark" }] },
        );
        expect(tokens.permutations.map(({ input, label }) => ({ input, label }))).toStrictEqual([
            { input: {}, label: "" },
        ]);
        expect(tokens.diagnostics).toStrictEqual([]);
    });
});

describe("what counts as a resolver: its name, or a top-level resolutionOrder", () => {
    const versioned = '{ "version": "1.0", "a": { "$type": "number", "$value": 1 } }';

    it("reads a file with only a version as token files, as a package.json would be", () => {
        const tokens = readFromMemory({ files: { "tokens.json": versioned } });
        expect(tokens.resolver).toBeUndefined();
        expect(tokens.diagnostics.map(({ kind }) => kind)).not.toContain("resolver-invalid");
    });

    it("finds no resolver among files where one only has a version", () => {
        const reading = () => readFromMemory({ files: { "a.json": versioned, "b.json": valid } });
        expect(reading).toThrow(/token files with no resolver among them/);
    });

    it("takes a file named .resolver.json as the resolver, so it can say what it lacks", () => {
        const tokens = readFromMemory({ files: { "x.resolver.json": "{}", "b.json": valid } });
        expect(tokens.entry).toBe("x.resolver.json");
        expect(tokens.diagnostics.map(({ kind }) => kind)).toContain("resolver-invalid");
    });

    it("refuses a source named .resolver.json as a resolver", () => {
        const tokens = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "other.resolver.json" }] },
                    ],
                }),
                "other.resolver.json": "{}",
            },
            entry: "tokens.resolver.json",
        });
        expect(tokens.diagnostics.map(({ detail }) => detail)).toContainEqual(
            expect.objectContaining({ rule: "resolver-as-source" }),
        );
    });
});

describe("readFromMemory", () => {
    it("refuses several token files with no resolver among them, naming them", () => {
        const reading = () =>
            readFromMemory({ files: { "base.json": valid, "./themes/dark.json": valid } });
        expect(reading).toThrow(TypeError);
        expect(reading).toThrow(/`base\.json`.*`themes\/dark\.json`/);
        expect(reading).toThrow(/a resolver says which files to read and in what order/);
    });

    it("refuses several resolvers when no entry says which, naming them", () => {
        const resolver = JSON.stringify({ version: "2025.10", resolutionOrder: [] });
        const reading = () =>
            readFromMemory({ files: { "a.resolver.json": resolver, "b.resolver.json": resolver } });
        expect(reading).toThrow(TypeError);
        expect(reading).toThrow(/`a\.resolver\.json`.*`b\.resolver\.json`/);
    });

    it("refuses to read no files at all", () => {
        expect(() => readFromMemory({ files: {} })).toThrow(TypeError);
    });

    it("reads several token files when an entry names the one to start from", () => {
        const tokens = readFromMemory({
            files: { "base.json": valid, "other.json": valid },
            entry: "base.json",
        });
        expect(tokens.files).toStrictEqual(["base.json"]);
    });

    it("finds an entry given with a folder among the files", () => {
        const tokens = readFromMemory({
            files: { "tokens/base.json": valid, "other.json": valid },
            entry: "tokens/base.json",
        });
        expect(tokens.files).toStrictEqual(["base.json"]);
        expect(tokens.diagnostics).toStrictEqual([]);
    });

    it("uses a resolver among the files as the entry, and ignores files it does not read", () => {
        const tokens = readFromMemory({
            files: {
                "stray.json": "{ // not read\n }",
                "design.resolver.json": '{ "version": "2025.10", "resolutionOrder": [] }',
            },
        });
        expect(tokens.files).toStrictEqual(["design.resolver.json"]);
        expect(tokens.diagnostics).toStrictEqual([]);
    });

    it("reports a syntax error in a resolver, but not its comments", () => {
        const tokens = readFromMemory({
            files: {
                "design.resolver.json":
                    '{ // fine here\n "version": "2025.10", "resolutionOrder": [], }',
            },
        });
        expect(tokens.diagnostics.map(({ kind, detail }) => ({ kind, detail }))).toStrictEqual([
            { kind: "invalid-json", detail: { reason: "property-name-expected" } },
        ]);
    });

    it("writes its plain form with JSON.stringify, each source once and placed by position", () => {
        const tokens = readFromMemory({ files: { "tokens.json": '{ "a": 1, "a": 2 }' } });
        expect(JSON.parse(JSON.stringify(tokens))).toMatchObject({
            files: ["tokens.json"],
            sources: [{ file: "tokens.json", sets: [], readBy: "everyone" }],
            permutations: [{ sources: [0] }],
        });
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
                detail: { chain: ["g"], toTopLevel: true },
                message: "these references lead back to where they started: g → the top level",
            },
        ]);
    });

    it('is told apart from a group named "", which #/ reaches (RFC 6901)', () => {
        const files = {
            "tokens.json": JSON.stringify({
                "": { $type: "number", x: { $value: 1 } },
                "g": { $ref: "#/" },
            }),
        };
        const tokens = readFromMemory({ files });
        expect(tokens.diagnostics).toStrictEqual([]);
        expect(tokens.permutation().token("g.x")?.inherited).toStrictEqual({ from: "" });
    });
    it('never reaches a token named "" through #, the whole document', () => {
        const files = {
            "tokens.json": JSON.stringify({
                "": { $type: "number", $value: 1 },
                "t": { $type: "number", $value: { $ref: "#" } },
            }),
        };
        expect(readFromMemory({ files }).permutation().token("t")?.resolved).toBeUndefined();
    });
});

describe("a member named like a property at the top of a file", () => {
    it("is not taken for `$value`, since the top of a file is never a token", () => {
        const tokens = readFromMemory({ files: { "tokens.json": JSON.stringify({ value: "x" }) } });
        expect(tokens.diagnostics.map(({ kind }) => kind)).toStrictEqual(["invalid-member"]);
    });
});

describe("labels", () => {
    const resolver = JSON.stringify({
        version: "2025.10",
        resolutionOrder: [
            {
                type: "modifier",
                name: "theme",
                default: "light",
                contexts: { light: [], dark: [] },
            },
            {
                type: "modifier",
                name: "size",
                default: "large",
                contexts: { default: [], large: [] },
            },
        ],
    });
    const tokens = readFromMemory({ files: { "tokens.resolver.json": resolver } });

    it("name each modifier's context, so a context called default can't be mistaken", () => {
        expect(tokens.permutations.map(({ input, label }) => [input, label])).toStrictEqual([
            [{ theme: "light", size: "default" }, "theme: light, size: default"],
            [{ theme: "light", size: "large" }, "theme: light, size: large"],
            [{ theme: "dark", size: "default" }, "theme: dark, size: default"],
            [{ theme: "dark", size: "large" }, "theme: dark, size: large"],
        ]);
    });

    it("are empty without a resolver, where there is nothing to choose", () => {
        const loose = readFromMemory({ files: { "tokens.json": valid } });
        expect(loose.permutations.map(({ label }) => label)).toStrictEqual([""]);
    });
});

describe("what the design tokens hold", () => {
    it("is the files and the entry, the resolver part, the sources, the permutations, how values were read and the problems", () => {
        const resolver = JSON.stringify({ version: "2025.10", resolutionOrder: [] });
        const tokens = readFromMemory({
            files: { "tokens.resolver.json": resolver },
            entry: "tokens.resolver.json",
        });
        expect(Object.keys(tokens)).toStrictEqual([
            "files",
            "entry",
            "resolver",
            "sources",
            "permutations",
            "parseOptions",
            "diagnostics",
        ]);
    });
});

describe("tokens.text", () => {
    const base = '{ "gap": { "$type": "number", "$value": 1 } }\n';
    const files = {
        "tokens.resolver.json": JSON.stringify({
            version: "2025.10",
            sets: { base: { sources: [{ $ref: "base.json" }] } },
            resolutionOrder: [{ $ref: "#/sets/base" }],
        }),
        "base.json": base,
        "unread.json": "{}",
    };

    it("is the text of each file the read used, by the name the design tokens give it", () => {
        const tokens = readFromMemory({ files, entry: "tokens.resolver.json" });
        expect(tokens.text("base.json")).toBe(base);
        expect(tokens.text("tokens.resolver.json")).toBe(files["tokens.resolver.json"]);
    });

    it("is undefined for a file the read did not use", () => {
        const tokens = readFromMemory({ files, entry: "tokens.resolver.json" });
        expect(tokens.text("unread.json")).toBeUndefined();
        expect(tokens.text("missing.json")).toBeUndefined();
    });

    it("is kept by read from disk too", async () => {
        const tokens = await read("tokens.resolver.json", {
            readText: async (path) => files[path as keyof typeof files],
        });
        expect(tokens.text("base.json")).toBe(base);
    });

    it("is not written in the plain form", () => {
        const tokens = readFromMemory({ files, entry: "tokens.resolver.json" });
        expect(JSON.stringify(tokens)).not.toContain("\\n");
        expect(JSON.parse(JSON.stringify(tokens))).not.toHaveProperty("text");
    });
});

describe("the group a generator is given", () => {
    const given: { path?: string; type?: string }[] = [];
    const recorder = defineGenerator({
        extension: ["com.example", "steps"],
        messages: {},
        generate: (group) => {
            given.push(group);
            return { ok: true, value: [] };
        },
    });
    const steps = { $extensions: { "com.example": { steps: 1 } } };
    const groupOf = (json: Record<string, unknown>) => {
        given.length = 0;
        const tokens = readFromMemory(
            { files: { "tokens.json": JSON.stringify(json) } },
            { generators: [recorder] },
        );
        return { given: given[0], tokens };
    };

    it("has the type it takes from a group it is inside (Format 6.7.3), as group.type does", () => {
        const { given: group, tokens } = groupOf({
            space: { $type: "dimension", fluid: { ...steps } },
        });
        expect(group).toStrictEqual({ path: "space.fluid", type: "dimension" });
        expect(tokens.permutation().group("space.fluid")?.type).toBe("dimension");
    });

    it("has its own type over the one around it", () => {
        const { given: group } = groupOf({
            space: { $type: "dimension", ratio: { $type: "number", ...steps } },
        });
        expect(group).toStrictEqual({ path: "space.ratio", type: "number" });
    });

    it("has the type of the group it extends, over the one around it (Format 6.4)", () => {
        const { given: group } = groupOf({
            base: { $type: "number" },
            space: { $type: "dimension", ratio: { $extends: "{base}", ...steps } },
        });
        expect(group).toStrictEqual({ path: "space.ratio", type: "number" });
    });

    it("has no type when nothing around it declares one", () => {
        const { given: group } = groupOf({ space: { fluid: { ...steps } } });
        expect(group).toStrictEqual({ path: "space.fluid" });
    });

    it("has the type the top level of the file declares, and no path", () => {
        const { given: group } = groupOf({ $type: "number", ...steps });
        expect(group).toStrictEqual({ type: "number" });
    });
});

describe("tokens.reread", () => {
    const steps = defineGenerator({
        extension: ["com.example", "steps"],
        messages: {},
        generate: () => ({ ok: true, value: [{ name: "1", $value: 1 }] }),
    });
    const base = (colour: string) =>
        JSON.stringify({
            brand: { $type: "color", $value: colour },
            space: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
        });
    const more = JSON.stringify({ gap: { $type: "number", $value: 2 } });
    const files = {
        "tokens.resolver.json": JSON.stringify({
            version: "2025.10",
            sets: { base: { sources: [{ $ref: "base.json" }, { $ref: "more.json" }] } },
            resolutionOrder: [{ $ref: "#/sets/base" }],
        }),
        "base.json": base("#ff0000"),
        "more.json": more,
    };
    const tokens = readFromMemory({ files }, { generators: [steps], hexStringColors: true });
    const changed = () => tokens.reread({ "base.json": base("#00ff00") });

    it("reads a changed file's new text, and every other file as this one read it", () => {
        expect(changed().permutation().token("brand")?.authored?.value).toBe("#00ff00");
        expect(changed().text("base.json")).toBe(base("#00ff00"));
        expect(changed().text("more.json")).toBe(more);
        expect(changed().permutation().token("gap")).toBeDefined();
    });

    it("reads with the same options", () => {
        expect(changed().permutation().token("space.1")?.generated).toBeDefined();
        expect(changed().diagnostics).toStrictEqual([]);
    });

    it("leaves out a file given as null, as if deleted", () => {
        const deleted = tokens.reread({ "more.json": null });
        expect(deleted.text("more.json")).toBeUndefined();
        expect(deleted.permutation().token("gap")).toBeUndefined();
        expect(deleted.diagnostics.map(({ kind }) => kind)).toStrictEqual(["file-not-found"]);
    });

    it("starts from the same file, whatever files are added", () => {
        const single = readFromMemory({ files: { "tokens.json": more } });
        const added = single.reread({ "notes.json": "{}" });
        expect(added.files).toStrictEqual(["tokens.json"]);
        expect(added.permutation().token("gap")).toBeDefined();
    });

    it("leaves the design tokens it was asked of as they were", () => {
        changed();
        tokens.reread({ "more.json": null });
        expect(tokens.permutation().token("brand")?.authored?.value).toBe("#ff0000");
        expect(tokens.text("base.json")).toBe(base("#ff0000"));
        expect(tokens.text("more.json")).toBe(more);
    });
});

describe("the top level of a file, to a generator or an extension check", () => {
    const seen: { generator?: unknown; validator?: unknown[] } = { validator: [] };
    const steps = defineGenerator({
        extension: ["com.example", "steps"],
        generate: (group) => {
            seen.generator = group;
            return { ok: false, errors: [{ jsonPath: [], reason: "nope" }] };
        },
        messages: { nope: () => "not this time" },
    });
    const notes = defineExtensionValidator({
        key: "com.example",
        appliesTo: ["group"],
        validate: (on) => {
            seen.validator?.push(on);
            return [];
        },
    });
    const tokens = readFromMemory(
        {
            files: {
                "tokens.json": JSON.stringify({
                    $type: "number",
                    $extensions: { "com.example": { steps: 1, note: true } },
                }),
            },
        },
        { generators: [steps], extensionValidators: [notes] },
    );

    it('is handed with no path, so it can\'t be taken for a group named ""', () => {
        expect(seen.generator).toStrictEqual({ type: "number" });
        expect(seen.validator).toContainEqual({ type: "group" });
    });

    it("names no path in a problem with its $type", () => {
        const typo = readFromMemory({
            files: { "tokens.json": JSON.stringify({ $type: "colour", a: { $value: 1 } }) },
        });
        const problem = typo.diagnostics.find(({ kind }) => kind === "unknown-type");
        expect(problem).toBeDefined();
        expect(problem && "path" in problem).toBe(false);
    });

    it("names no path in a problem about it", () => {
        const problem = tokens.diagnostics.find(({ kind }) => kind === "extension-invalid");
        expect(problem).toBeDefined();
        expect(problem && "path" in problem).toBe(false);
    });
});

describe("the resolver part", () => {
    it("is absent for a token file read without a resolver", () => {
        expect(readFromMemory({ files: { "tokens.json": valid } }).resolver).toBeUndefined();
    });

    it("reports a set or modifier resolutionOrder never reaches as a hint editors fade", () => {
        const resolver = JSON.stringify({
            version: "2025.10",
            sets: { spare: { sources: [] } },
            resolutionOrder: [],
        });
        const tokens = readFromMemory({
            files: { "tokens.resolver.json": resolver },
            entry: "tokens.resolver.json",
        });
        expect(tokens.diagnostics).toMatchObject([
            {
                kind: "not-in-resolution-order",
                severity: "hint",
                tags: ["unnecessary"],
                detail: { item: "set", name: "spare" },
            },
        ]);
    });
});
