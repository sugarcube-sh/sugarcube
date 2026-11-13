import { describe, expect, it, vi } from "vitest";
import {
    type DesignTokens,
    EntryFileError,
    type ReadOptions,
    type ReadText,
    defineExtensionValidator,
    defineGenerator,
    getFilePath,
    read,
    readFromMemory,
} from "../../src/index.js";
import { oneFile, oneSet } from "../token-files.js";

const valid = '{ "a": { "$type": "number", "$value": 1 } }';

const problems = (tokens: DesignTokens) =>
    tokens.diagnostics.map(({ kind, detail }) => ({ kind, detail }));

function where(text: string) {
    const [first] = readFromMemory({ files: { "tokens.json": text } }).diagnostics;
    return (
        first?.span && { offset: first.span.offset, start: first.span.start, end: first.span.end }
    );
}

describe("positions", () => {
    it("counts columns in UTF-16 units, so a character outside the Basic Multilingual Plane is two", () => {
        expect(where('{ "🎨": 1, }')).toStrictEqual({
            offset: 9,
            start: { line: 1, column: 10 },
            end: { line: 1, column: 11 },
        });
    });

    it.for([
        ["\n", "a line feed"],
        ["\r\n", "a carriage return and line feed"],
        ["\r", "a carriage return alone"],
    ])("ends a line at %j, %s", ([newline]) => {
        const text = `{${newline}  "a": 1${newline}  "b": 2${newline}}`;
        expect(where(text)).toStrictEqual({
            offset: text.indexOf('"b"'),
            start: { line: 3, column: 3 },
            end: { line: 3, column: 6 },
        });
    });

    it("ignores a byte order mark, and still counts it in offsets", () => {
        expect(
            readFromMemory({ files: { "tokens.json": `\uFEFF${valid}` } }).diagnostics,
        ).toStrictEqual([]);
        expect(where('\uFEFF{ "a": 1, }')).toStrictEqual({
            offset: 9,
            start: { line: 1, column: 10 },
            end: { line: 1, column: 11 },
        });
    });

    it("reports a comment and a syntax error in the same file, in file order", () => {
        const tokens = readFromMemory({ files: { "tokens.json": '{ "a": 1 // note\n "b": 2 }' } });
        expect(tokens.diagnostics.map(({ detail }) => detail)).toStrictEqual([
            { reason: "comment" },
            { reason: "comma-expected" },
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
        expect(problems(tokens)).toStrictEqual([
            { kind: "duplicate-key", detail: { key: "b" } },
            { kind: "duplicate-key", detail: { key: "b" } },
        ]);
    });
});

describe("what breaks a rule of the spec is an error, and what is set aside a warning", () => {
    const severities = (text: string, options: ReadOptions = {}, file = "tokens.json") =>
        readFromMemory({ files: { [file]: text } }, options).diagnostics.map(
            ({ kind, severity, detail }) => [
                kind,
                severity,
                "property" in detail ? detail.property : "",
            ],
        );

    it("a key written twice and an unknown property in a value are warnings", () => {
        const text = `{
            "a": { "$type": "number", "$value": 1 },
            "a": { "$type": "number", "$value": 2 },
            "c": { "$type": "dimension", "$value": { "value": 1, "unit": "px", "fluid": true } }
        }`;
        expect(severities(text, { ignoreUnknownProperties: true })).toStrictEqual([
            ["duplicate-key", "warning", ""],
            ["unknown-property", "warning", "fluid"],
        ]);
    });

    it("a property the specification does not define on a token or a group is an error, and a $ key at the start of a token file is set aside with a warning, $schema allowed", () => {
        const text = `{
            "$schema": "https://www.designtokens.org/schemas/2025.10/format.json",
            "$themes": [],
            "g": { "$note": "ours", "a": { "$type": "number", "$value": 1, "$figmaId": "12:34" } }
        }`;
        expect(severities(text)).toStrictEqual([
            ["unknown-property", "warning", "$themes"],
            ["unknown-property", "error", "$note"],
            ["unknown-property", "error", "$figmaId"],
        ]);
    });

    it("$extends on a token is an error, since only a group extends", () => {
        const text = `{
            "b": { "c": { "$type": "number", "$value": 3 } },
            "g": { "$type": "number", "$value": 1, "$extends": "{b}" },
            "h": { "$type": "number", "$ref": "#/b/c/$value", "$extends": "{b}" }
        }`;
        expect(severities(text)).toStrictEqual([
            ["unknown-property", "error", "$extends"],
            ["unknown-property", "error", "$extends"],
        ]);
    });

    it("$value or $ref at the top of a file is an error, since the top is never a token", () => {
        const text = `{
            "$type": "number",
            "$value": 1,
            "$ref": "#/a/$value",
            "a": { "$value": 2 }
        }`;
        expect(severities(text)).toStrictEqual([
            ["unknown-property", "error", "$value"],
            ["unknown-property", "error", "$ref"],
        ]);
    });

    it("$root inside a token is a member, which a token cannot hold", () => {
        const text = `{ "a": { "$type": "number", "$value": 1, "$root": { "$value": 2 } } }`;
        const tokens = readFromMemory({ files: { "tokens.json": text } });
        expect(problems(tokens)).toStrictEqual([
            {
                kind: "token-and-group",
                detail: { reason: "child", child: "$root", found: "object" },
            },
        ]);
    });

    it("a property the specification does not define on a resolver, a set or a modifier is an error", () => {
        const text = JSON.stringify({
            version: "2025.10",
            $schema: "https://www.designtokens.org/schemas/2025.10/resolver.json",
            $defs: {},
            owner: "design",
            sets: { base: { sources: [], colour: "red" } },
            modifiers: { mode: { contexts: { light: [], dark: [] }, default: "light", x: 1 } },
            resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/mode" }],
        });
        expect(severities(text, {}, "tokens.resolver.json")).toStrictEqual([
            ["unknown-property", "error", "owner"],
            ["unknown-property", "error", "colour"],
            ["unknown-property", "error", "x"],
        ]);
    });

    it("a description, deprecation or extensions of the wrong kind is an error, and the token is still read", () => {
        const text = `{
            "a": { "$type": "number", "$value": 2, "$description": 5 },
            "b": { "$type": "number", "$value": 1, "$deprecated": 1, "$extensions": [] },
            "g": { "$description": 5, "$deprecated": {}, "$extensions": [], "c": { "$type": "number", "$value": 3 } }
        }`;
        expect(severities(text)).toStrictEqual([
            ["invalid-property", "error", "$description"],
            ["invalid-property", "error", "$deprecated"],
            ["invalid-property", "error", "$extensions"],
            ["invalid-property", "error", "$description"],
            ["invalid-property", "error", "$deprecated"],
            ["invalid-property", "error", "$extensions"],
        ]);
        const tokens = readFromMemory({ files: { "tokens.json": text } }).getPermutation();
        expect(tokens.tokens.map(({ path }) => path)).toStrictEqual(["a", "b", "g.c"]);
        expect(tokens.getToken("a")?.description).toBeUndefined();
    });

    it("a pointer without its slash is an error in a reference to another file, as in a token file", () => {
        const tokens = readFromMemory({
            files: {
                "tokens.resolver.json": oneSet("all.json#space"),
                "all.json": JSON.stringify({
                    space: { $type: "number", one: { $value: 1 }, two: { $ref: "#space/one" } },
                }),
            },
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
            { file: "base.json", sets: [], contexts: "every-context" },
        ]);
    });

    it("tidies the entry's folder", async () => {
        const readText = vi.fn(async () => valid);
        await read("./tokens/../design/base.json", { readText });
        expect(readText.mock.calls).toStrictEqual([["design/base.json", "base.json"]]);
    });

    it("reports a file as not found when readText gives undefined", async () => {
        const tokens = await read("tokens.json", { readText: async () => undefined });
        expect(problems(tokens)).toStrictEqual([
            { kind: "file-not-found", detail: { file: "tokens.json" } },
        ]);
    });

    const offline = new Error("offline");
    it.for<[string, string, string, ReadText]>([
        [
            "rejects, naming the file, when readText rejects",
            "tokens/tokens.json",
            "tokens/tokens.json",
            () => Promise.reject(offline),
        ],
        [
            "rejects when readText throws before returning a promise",
            "tokens.json",
            "tokens.json",
            () => {
                throw offline;
            },
        ],
        [
            "rejects when a file the resolver names cannot be read, not only the entry",
            "tokens.resolver.json",
            "base.json",
            async (path) => (path === "base.json" ? Promise.reject(offline) : oneSet("base.json")),
        ],
    ])("%s", async ([, entry, names, readText]) => {
        const reading = read(entry, { readText });
        await expect(reading).rejects.toThrow(names);
        await expect(reading).rejects.toMatchObject({ cause: offline });
    });

    it("reports the time the load took", async () => {
        const onStage = vi.fn();
        await read("tokens.json", { readText: async () => valid, onStage });
        expect(onStage).toHaveBeenCalledWith("load", expect.any(Number));
    });

    it("reports every stage once, in order", async () => {
        const onStage = vi.fn();
        await read("tokens.json", { readText: async () => valid, onStage });
        expect(onStage.mock.calls.map(([stage]) => stage)).toEqual([
            "load",
            "generate",
            "merge",
            "build",
            "validate-extensions",
        ]);
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

    it("names each file it asks for as the design tokens will name it, and getFilePath gives back the path it asked for", async () => {
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
        expect(
            asked.map(([, file]) => getFilePath("tokens/design.resolver.json", file)),
        ).toStrictEqual(asked.map(([path]) => path));
    });

    it("finds a file by the entry's folder, a file nothing has read yet included", () => {
        expect(getFilePath("tokens/tokens.resolver.json", "themes/new.json")).toBe(
            "tokens/themes/new.json",
        );
        expect(getFilePath("tokens.resolver.json", "dark.json")).toBe("dark.json");
    });

    it("leaves a file named from the root as written", () => {
        expect(getFilePath("/project/tokens/tokens.resolver.json", "/shared/brand.json")).toBe(
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
        expect(problems(tokens)).toStrictEqual([
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

    it.for<[string, number, boolean, { permutationLimit?: number }, number, unknown[]]>([
        ["builds every combination up to the limit, and no warning", 5, true, {}, 32, []],
        ["takes a higher limit", 6, true, { permutationLimit: 64 }, 64, []],
        [
            "builds every combination above it when no modifier has a default, and says so",
            6,
            false,
            {},
            64,
            [{ kind: "permutation-limit", detail: { count: 64, limit: 32, built: 64 } }],
        ],
    ])("%s", ([, count, defaults, options, length, diagnostics]) => {
        const tokens = readWith(withModifiers(count, defaults), options);
        expect(tokens.permutations).toHaveLength(length);
        expect(problems(tokens)).toStrictEqual(diagnostics);
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
        expect(problems(tokens)).toStrictEqual([
            { kind: "permutation-limit", detail: { count: 64, limit: 32, built: 7 } },
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
            { inputs: "each-context" },
        );
        return {
            inputs: tokens.permutations.inputs,
            diagnostics: problems(tokens),
        };
    };

    it('builds every combination for inputs: "all", the default, and takes no permutations option', () => {
        const text = resolver({
            theme: { contexts: { light: [], dark: [] }, default: "light" },
            size: { contexts: { small: [], large: [] }, default: "small" },
        });
        const all = readFromMemory({ files: { "tokens.resolver.json": text } }, { inputs: "all" });
        const unset = readFromMemory({ files: { "tokens.resolver.json": text } });
        expect(all.permutations).toHaveLength(4);
        expect(unset.permutations.inputs).toStrictEqual(all.permutations.inputs);
        // @ts-expect-error which permutations to build is inputs
        readFromMemory({ files: { "tokens.resolver.json": text } }, { permutations: "all" });
    });

    it.for<[string, Record<string, unknown>, Record<string, string>[]]>([
        [
            "builds the default, then each context with the other modifiers at their defaults",
            {
                theme: { contexts: { light: [], dark: [], dim: [] }, default: "light" },
                brand: { contexts: { house: [], ocean: [] }, default: "house" },
            },
            [
                { theme: "light", brand: "house" },
                { theme: "dark", brand: "house" },
                { theme: "dim", brand: "house" },
                { theme: "light", brand: "ocean" },
            ],
        ],
        [
            "lists them in the resolver's order, the default where its contexts are written",
            {
                theme: { contexts: { dark: [], light: [], dim: [] }, default: "light" },
                brand: { contexts: { ocean: [], house: [] }, default: "house" },
            },
            [
                { theme: "dark", brand: "house" },
                { theme: "light", brand: "house" },
                { theme: "dim", brand: "house" },
                { theme: "light", brand: "ocean" },
            ],
        ],
        [
            "builds the other modifiers' contexts with each context of a modifier with no default",
            {
                size: { contexts: { small: [], large: [] } },
                brand: { contexts: { house: [], ocean: [] }, default: "house" },
            },
            [
                { size: "small", brand: "house" },
                { size: "large", brand: "house" },
                { size: "small", brand: "ocean" },
                { size: "large", brand: "ocean" },
            ],
        ],
        [
            "builds each context of the only modifier, which has no default",
            { theme: { contexts: { light: [], dark: [] } } },
            [{ theme: "light" }, { theme: "dark" }],
        ],
        [
            "builds the others' contexts with every combination of the modifiers with no default",
            {
                size: { contexts: { small: [], large: [] } },
                theme: { contexts: { light: [], dark: [] } },
                brand: { contexts: { house: [], ocean: [] }, default: "house" },
                density: { contexts: { regular: [], compact: [] }, default: "regular" },
            },
            [
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
        ],
    ])("%s", ([, modifiers, inputs]) => {
        expect(built(resolver(modifiers))).toStrictEqual({ inputs, diagnostics: [] });
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
        expect(tokens.entryFile).toBe("x.resolver.json");
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
            entryFile: "tokens.resolver.json",
        });
        expect(tokens.diagnostics.map(({ detail }) => detail)).toContainEqual(
            expect.objectContaining({ rule: "resolver-as-source" }),
        );
    });
});

function thrownBy(reading: () => unknown): unknown {
    try {
        reading();
    } catch (error) {
        if (error instanceof EntryFileError) return error.detail;
    }
    return undefined;
}

describe("readFromMemory", () => {
    it("refuses several token files with no resolver among them, naming them", () => {
        const reading = () =>
            readFromMemory({ files: { "base.json": valid, "./themes/dark.json": valid } });
        expect(reading).toThrow(EntryFileError);
        expect(reading).toThrow(/`base\.json`.*`themes\/dark\.json`/);
        expect(reading).toThrow(/a resolver says which files to read and in what order/);
        expect(thrownBy(reading)).toStrictEqual({
            reason: "no-resolver",
            files: ["base.json", "themes/dark.json"],
        });
    });

    it("refuses several resolvers when no entry says which, naming them", () => {
        const resolver = JSON.stringify({
            version: "2025.10",
            resolutionOrder: [{ type: "set", name: "base", sources: [] }],
        });
        const reading = () =>
            readFromMemory({ files: { "a.resolver.json": resolver, "b.resolver.json": resolver } });
        expect(reading).toThrow(EntryFileError);
        expect(reading).toThrow(/`a\.resolver\.json`.*`b\.resolver\.json`/);
        expect(thrownBy(reading)).toStrictEqual({
            reason: "several-resolvers",
            files: ["a.resolver.json", "b.resolver.json"],
        });
    });

    it("refuses to read no files at all", () => {
        const reading = () => readFromMemory({ files: {} });
        expect(reading).toThrow(EntryFileError);
        expect(thrownBy(reading)).toStrictEqual({ reason: "no-resolver", files: [] });
    });

    it.for<[string, string]>([
        ["reads several token files when an entry names the one to start from", "base.json"],
        ["finds an entry given with a folder among the files", "tokens/base.json"],
    ])("%s", ([, entryFile]) => {
        const tokens = readFromMemory({
            files: { [entryFile]: valid, "other.json": valid },
            entryFile,
        });
        expect(tokens.files).toStrictEqual(["base.json"]);
        expect(tokens.diagnostics).toStrictEqual([]);
    });

    it("uses a resolver among the files as the entry, and ignores files it does not read", () => {
        const tokens = readFromMemory({
            files: {
                "stray.json": "{ // not read\n }",
                "design.resolver.json":
                    '{ "version": "2025.10", "resolutionOrder": [{ "type": "set", "name": "base", "sources": [] }] }',
            },
        });
        expect(tokens.files).toStrictEqual(["design.resolver.json"]);
        expect(tokens.diagnostics).toStrictEqual([]);
    });

    it("reports a comma after a comma once, as a missing value, not a trailing comma too", () => {
        const tokens = readFromMemory({ files: { "tokens.json": '{ "a": [1,,] }' } });
        expect(tokens.diagnostics.map(({ detail }) => detail)).toStrictEqual([
            { reason: "value-expected" },
        ]);
    });

    it("reports a syntax error in a resolver, but not its comments", () => {
        const tokens = readFromMemory({
            files: {
                "design.resolver.json":
                    '{ // fine here\n "version": "2025.10" "resolutionOrder": [] }',
            },
        });
        expect(problems(tokens)).toStrictEqual([
            { kind: "invalid-json", detail: { reason: "comma-expected" } },
        ]);
    });
});

describe("a group referring to the whole document", () => {
    it("is circular, as the document holds the group, and names the top level", () => {
        const found = oneFile({ g: { $extends: { $ref: "#" } } }).diagnostics.map(
            ({ kind, detail, message }) => ({
                kind,
                detail,
                message,
            }),
        );
        expect(found).toStrictEqual([
            {
                kind: "circular-reference",
                detail: { chain: ["g", ""] },
                message: "circular reference through `g`, the top level",
            },
        ]);
    });

    it('never reaches a token named "", which is not a name, through #, the whole document', () => {
        const tokens = oneFile({
            "": { $type: "number", $value: 1 },
            "t": { $type: "number", $value: { $ref: "#" } },
        });
        expect(tokens.diagnostics.map(({ kind }) => kind)).toContain("invalid-name");
        expect(tokens.getPermutation().getToken("t")?.resolved).toBeUndefined();
    });
});

describe("a $root token", () => {
    it("can be written with $ref, as any token can", () => {
        const tokens = oneFile({
            a: { $type: "number", $value: 2 },
            g: { $type: "number", $root: { $ref: "#/a/$value" } },
        });
        expect(tokens.diagnostics).toStrictEqual([]);
        expect(tokens.getPermutation().getToken("g.$root")?.resolved).toBe(2);
    });
});

describe("a member named like a property at the top of a file", () => {
    it("is not taken for `$value`, since the top of a file is never a token", () => {
        const tokens = oneFile({ value: "x" });
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
});

describe("what the design tokens hold", () => {
    it("is the files and the entry, the resolver part, the sources, the permutations, how values were read and the problems", () => {
        const tokens = readFromMemory({ files: { "tokens.resolver.json": oneSet() } });
        expect(Object.keys(tokens)).toStrictEqual([
            "files",
            "entryFile",
            "resolver",
            "sources",
            "permutations",
            "parseOptions",
            "diagnostics",
        ]);
    });
});

describe("tokens.getText", () => {
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
        const tokens = readFromMemory({ files });
        expect(tokens.getText("base.json")).toBe(base);
        expect(tokens.getText("tokens.resolver.json")).toBe(files["tokens.resolver.json"]);
    });

    it("is undefined for a file the read did not use", () => {
        const tokens = readFromMemory({ files });
        expect(tokens.getText("unread.json")).toBeUndefined();
        expect(tokens.getText("missing.json")).toBeUndefined();
    });

    it("is not written in the plain form", () => {
        const tokens = readFromMemory({ files });
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
        const tokens = oneFile(json, { generators: [recorder] });
        return { given: given[0], tokens };
    };

    it("has the type it takes from a group it is inside (Format 6.7.3), as group.type does", () => {
        const { given: group, tokens } = groupOf({
            space: { $type: "dimension", fluid: { ...steps } },
        });
        expect(group).toStrictEqual({ path: "space.fluid", type: "dimension" });
        expect(tokens.getPermutation().getGroup("space.fluid")?.type).toBe("dimension");
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

    it('has the type the top level of the file declares, and the top level\'s path, ""', () => {
        const { given: group } = groupOf({ $type: "number", ...steps });
        expect(group).toStrictEqual({ path: "", type: "number" });
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
    const tokens = oneFile(
        { $type: "number", $extensions: { "com.example": { steps: 1, note: true } } },
        { generators: [steps], extensionValidators: [notes] },
    );

    it('is handed the top level\'s path, ""', () => {
        expect(seen.generator).toStrictEqual({ path: "", type: "number" });
        expect(seen.validator).toContainEqual({ path: "", type: "group" });
    });

    it('names the top level, "", in a problem with its $type', () => {
        const typo = oneFile({ $type: "colour", a: { $value: 1 } });
        const problem = typo.diagnostics.find(({ kind }) => kind === "unknown-type");
        expect(problem?.path).toBe("");
    });

    it('names the top level, "", in a problem about it', () => {
        const problem = tokens.diagnostics.find(({ kind }) => kind === "extension-invalid");
        expect(problem?.path).toBe("");
    });
});

describe("the resolver part", () => {
    it("reports a set or modifier resolutionOrder never reaches as a hint editors fade", () => {
        const resolver = JSON.stringify({
            version: "2025.10",
            sets: { spare: { sources: [] } },
            resolutionOrder: [{ type: "set", name: "base", sources: [] }],
        });
        const tokens = readFromMemory({ files: { "tokens.resolver.json": resolver } });
        expect(tokens.diagnostics).toMatchObject([
            {
                kind: "not-in-resolution-order",
                severity: "hint",
                tags: ["unnecessary"],
            },
        ]);
    });
});
