import { type DesignTokens, type Input, defineGenerator, readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { setDescription, setValue } from "../src/index.js";
import { demo, at, opsOf, committed, resolver, opened, plainly } from "./helpers.js";
describe("setValue, the shared value", () => {
    it("is one edit where the token is written, leaving dark's override alone", () => {
        const result = setValue(demo, "color.text.brand", "{color.brand.800}");

        expect(opsOf(result)).toEqual([
            {
                kind: "set",
                file: "color.json",
                jsonPath: ["color", "text", "brand", "$value"],
                value: "{color.brand.800}",
                was: "{color.brand.700}",
            },
        ]);
        const after = committed(demo, result);
        expect(after.getPermutation().getToken("color.text.brand")?.original?.value).toBe(
            "{color.brand.800}",
        );
        expect(
            after.getPermutation({ mode: "dark" }).getToken("color.text.brand")?.original?.value,
        ).toBe("{color.brand.300}");
    });

    it("says which contexts see the change", () => {
        const brand = setValue(demo, "color.text.brand", "{color.brand.800}");
        const radius = setValue(demo, "radius.md", { value: 0.3, unit: "rem" });

        expect(brand.ops && brand.affectedPermutations.inputs).toEqual([{ mode: "light" }]);
        expect(radius.ops && radius.affectedPermutations.inputs).toEqual([
            { mode: "light" },
            { mode: "dark" },
        ]);
    });

    it("treats a context at its default as none", () => {
        expect(setValue(demo, "radius.md", 1, { input: { mode: "light" } })).toEqual(
            setValue(demo, "radius.md", 1),
        );
    });

    it("writes the value exactly as given, even one the read will call wrong", () => {
        const hex = committed(demo, setValue(demo, "color.brand.500", "#e11d48"));
        const words = committed(demo, setValue(demo, "radius.md", "sixteen pixels"));

        expect(at(hex, "color.json", ["color", "brand", "500", "$value"])).toBe("#e11d48");
        expect(at(words, "radius.json", ["radius", "md", "$value"])).toBe("sixteen pixels");
        expect(words.diagnostics.some((each) => each.path === "radius.md")).toBe(true);
    });

    it("edits a shared value every context overrides, and says no context sees it", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [{ $ref: "./light.json" }],
                dark: [{ $ref: "./dark.json" }],
            }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "light.json": '{ "bg": { "$type": "color", "$value": "#fafafa" } }',
            "dark.json": '{ "bg": { "$type": "color", "$value": "#000000" } }',
        };

        expect(plainly(setValue(opened(files), "bg", "#eeeeee"))).toEqual({
            ops: [
                {
                    kind: "set",
                    file: "base.json",
                    jsonPath: ["bg", "$value"],
                    value: "#eeeeee",
                    was: "#ffffff",
                },
            ],
            affectedPermutations: [],
            moves: [],
        });
    });

    it("edits the shared value that wins, when two files every permutation reads write it", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }, { $ref: "./brand.json" }]),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "brand.json": '{ "bg": { "$type": "color", "$value": "#fafafa" } }',
        };

        expect(opsOf(setValue(opened(files), "bg", "#eeeeee"))).toEqual([
            {
                kind: "set",
                file: "brand.json",
                jsonPath: ["bg", "$value"],
                value: "#eeeeee",
                was: "#fafafa",
            },
        ]);
    });

    it("is refused for a shared value when only contexts write the token", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }],
            }),
            "base.json": "{}",
            "dark.json": '{ "glow": { "$type": "color", "$value": "#000000" } }',
        };

        expect(setValue(opened(files), "glow", "#111111")).toEqual({
            refusal: { kind: "no-shared-value", path: "glow", reason: expect.any(String) },
        });
    });

    it("names no context when the design tokens have no modifiers", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
        };
        const result = setValue(opened(files), "bg", "#eeeeee");

        expect(result.ops && result.affectedPermutations.inputs).toEqual([]);
    });

    it("is refused for a token that doesn't exist", () => {
        expect(setValue(demo, "color.nope", "#000")).toEqual({
            refusal: { kind: "not-found", path: "color.nope", reason: expect.any(String) },
        });
    });
});

describe("setValue, for one context", () => {
    it("names no permutation of the context it changes as also affected", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }],
            }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "dark.json": "{}",
        };
        const edit = setValue(opened(files), "bg", "#000000", { input: { mode: "dark" } });
        expect(edit.ops && edit.affectedPermutations.inputs).toEqual([]);
    });

    it("names a context that reads the same file only where that file's value wins", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./night.json" }],
                dim: [{ $ref: "./night.json" }, { $ref: "./dim.json" }],
            }),
            "base.json":
                '{ "bg": { "$type": "color", "$value": "#ffffff" }, "text": { "$type": "color", "$value": "#000000" } }',
            "night.json":
                '{ "bg": { "$type": "color", "$value": "#000000" }, "text": { "$type": "color", "$value": "#ffffff" } }',
            "dim.json": '{ "bg": { "$type": "color", "$value": "#222222" } }',
        };
        const tokens = opened(files);
        const bg = setValue(tokens, "bg", "#111111", { input: { mode: "dark" } });
        const text = setValue(tokens, "text", "#eeeeee", { input: { mode: "dark" } });
        expect(opsOf(bg)[0]?.file).toBe("night.json");
        expect(bg.ops && bg.affectedPermutations.inputs).toEqual([]);
        expect(text.ops && text.affectedPermutations.inputs).toEqual([{ mode: "dim" }]);
    });

    const dark = { input: { mode: "dark" } };

    it("changes dark's own override, in dark's file only", () => {
        const result = setValue(demo, "color.text.brand", "{color.brand.200}", dark);

        expect(result.ops && result.affectedPermutations.inputs).toEqual([]);
        expect(opsOf(result)).toEqual([
            {
                kind: "set",
                file: "dark.json",
                jsonPath: ["color", "text", "brand", "$value"],
                value: "{color.brand.200}",
                was: "{color.brand.300}",
            },
        ]);
    });

    it("adds an override in the context's file when it has none yet", () => {
        const result = setValue(demo, "radius.md", { value: 0.5, unit: "rem" }, dark);

        expect(opsOf(result)).toEqual([
            {
                kind: "add",
                file: "dark.json",
                jsonPath: ["radius", "md"],
                value: { $value: { value: 0.5, unit: "rem" } },
            },
        ]);
        const after = committed(demo, result);
        expect(after.getPermutation({ mode: "dark" }).getToken("radius.md")?.resolved).toEqual({
            value: 0.5,
            unit: "rem",
        });
        expect(after.getPermutation().getToken("radius.md")?.resolved).toEqual({
            value: 0.25,
            unit: "rem",
        });
    });

    it("writes the type into a new override when the token declared its own", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }],
            }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "dark.json": "{}",
        };

        expect(opsOf(setValue(opened(files), "bg", "#000000", dark))).toEqual([
            {
                kind: "add",
                file: "dark.json",
                jsonPath: ["bg"],
                value: { $type: "color", $value: "#000000" },
            },
        ]);
    });

    it("keeps the token's own description, deprecation and extensions in a new override", () => {
        const bg = {
            $type: "color",
            $value: "#ffffff",
            $description: "The page.",
            $deprecated: "Use surface.",
            $extensions: { "com.example": { role: "page" } },
        };
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }],
            }),
            "base.json": JSON.stringify({ bg }),
            "dark.json": "{}",
        };
        const tokens = opened(files);
        const result = setValue(tokens, "bg", "#000000", dark);

        expect(opsOf(result)).toEqual([
            {
                kind: "add",
                file: "dark.json",
                jsonPath: ["bg"],
                value: { ...bg, $value: "#000000" },
            },
        ]);
        expect(
            committed(tokens, result).getPermutation({ mode: "dark" }).getToken("bg"),
        ).toMatchObject({
            description: "The page.",
            deprecated: "Use surface.",
            extensions: { "com.example": { role: "page" } },
        });
    });

    it("leaves out a deprecation the token takes from its group, which still reaches it", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }],
            }),
            "base.json": JSON.stringify({
                old: { $type: "color", $deprecated: true, bg: { $value: "#ffffff" } },
            }),
            "dark.json": "{}",
        };
        const tokens = opened(files);
        const result = setValue(tokens, "old.bg", "#000000", dark);

        expect(opsOf(result)).toEqual([
            {
                kind: "add",
                file: "dark.json",
                jsonPath: ["old", "bg"],
                value: { $value: "#000000" },
            },
        ]);
        expect(
            committed(tokens, result).getPermutation({ mode: "dark" }).getToken("old.bg")
                ?.deprecated,
        ).toBe(true);
    });

    it("asks which file when the context reads several, and takes the answer", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }, { $ref: "./dark-extra.json" }],
            }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "dark.json": "{}",
            "dark-extra.json": "{}",
        };
        const tokens = opened(files);

        const edit = setValue(tokens, "bg", "#000000", dark);
        expect(edit.question).toMatchObject({
            kind: "placement",
            path: "bg",
            files: ["dark.json", "dark-extra.json"],
        });
        expect(edit.question?.answer("base.json").question?.files).toStrictEqual([
            "dark.json",
            "dark-extra.json",
        ]);
        expect(opsOf(edit.question?.answer("dark-extra.json") ?? edit)).toEqual([
            {
                kind: "add",
                file: "dark-extra.json",
                jsonPath: ["bg"],
                value: { $type: "color", $value: "#000000" },
            },
        ]);
    });

    it("writes into the context's file that declares the token's group, without asking", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }, { $ref: "./dark-colors.json" }],
            }),
            "base.json": '{ "color": { "$type": "color", "bg": { "$value": "#ffffff" } } }',
            "dark.json": "{}",
            "dark-colors.json": '{ "color": { "fg": { "$value": "#ffffff" } } }',
        };

        expect(opsOf(setValue(opened(files), "color.bg", "#000000", dark))).toEqual([
            {
                kind: "add",
                file: "dark-colors.json",
                jsonPath: ["color", "bg"],
                value: { $value: "#000000" },
            },
        ]);
    });

    it("is refused when a file read later would win over the new override", () => {
        const files = {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                    {
                        type: "modifier",
                        name: "mode",
                        default: "light",
                        contexts: { light: [], dark: [{ $ref: "./dark.json" }] },
                    },
                    {
                        type: "modifier",
                        name: "brand",
                        default: "a",
                        contexts: { a: [{ $ref: "./a.json" }], b: [] },
                    },
                ],
            }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "dark.json": "{}",
            "a.json": '{ "bg": { "$type": "color", "$value": "#eeeeee" } }',
        };

        expect(setValue(opened(files), "bg", "#000000", dark)).toEqual({
            refusal: {
                kind: "hidden-by-later-file",
                path: "bg",
                input: { mode: "dark" },
                file: "a.json",
                reason: expect.any(String),
            },
        });
    });

    it("is refused for a context the resolver doesn't have", () => {
        expect(setValue(demo, "radius.md", 1, { input: { mode: "dim" } })).toEqual({
            refusal: {
                kind: "no-permutation",
                input: { mode: "dim" },
                cause: "unknown-context",
                reason: expect.any(String),
            },
        });
    });

    it("is refused for a context that isn't a string", () => {
        expect(setValue(demo, "radius.md", 1, { input: { mode: 1 } as unknown as Input })).toEqual({
            refusal: {
                kind: "no-permutation",
                input: { mode: 1 },
                cause: "not-a-string",
                reason: expect.stringContaining(
                    ": a context was given as something other than a string",
                ),
            },
        });
    });

    it("is refused for two contexts at once", () => {
        const files = {
            "tokens.resolver.json": JSON.stringify({
                version: "2025.10",
                resolutionOrder: [
                    { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                    {
                        type: "modifier",
                        name: "mode",
                        default: "light",
                        contexts: { light: [], dark: [] },
                    },
                    { type: "modifier", name: "brand", default: "a", contexts: { a: [], b: [] } },
                ],
            }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
        };

        expect(
            setValue(opened(files), "bg", "#000000", { input: { mode: "dark", brand: "b" } }),
        ).toEqual({
            refusal: {
                kind: "several-contexts",
                input: { mode: "dark", brand: "b" },
                reason: "an override for `mode: dark, brand: b` at once can't be written: no file is read by that combination alone",
            },
        });
    });

    it("is refused when the context reads no file of its own", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], { light: [], dark: [] }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
        };

        expect(setValue(opened(files), "bg", "#000000", dark)).toEqual({
            refusal: {
                kind: "no-file-for-context",
                path: "bg",
                input: { mode: "dark" },
                reason: expect.any(String),
            },
        });
    });
});

describe("setValue, what it can't change", () => {
    it("changes a token read from part of a file where the file writes it", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./all.json#/tokens" }]),
            "all.json": '{ "tokens": { "bg": { "$type": "color", "$value": "#ffffff" } } }',
        };

        expect(opsOf(setValue(opened(files), "bg", "#000000"))).toEqual([
            {
                kind: "set",
                file: "all.json",
                jsonPath: ["tokens", "bg", "$value"],
                value: "#000000",
                was: "#ffffff",
            },
        ]);
    });

    it("adds no override into a file the context reads only part of", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json#/tokens" }],
            }),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "dark.json": '{ "tokens": {} }',
        };

        expect(setValue(opened(files), "bg", "#000000", { input: { mode: "dark" } })).toEqual({
            refusal: {
                kind: "no-file-for-context",
                path: "bg",
                input: { mode: "dark" },
                reason: expect.any(String),
            },
        });
    });

    it("is refused for a token a generator makes, naming the group whose extension makes it", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: (_group, count) => ({
                ok: true,
                value: Array.from({ length: Number(count) }, (_, i) => ({
                    name: String(i + 1),
                    $value: { value: i + 1, unit: "rem" },
                })),
            }),
        });
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./space.json" }]),
            "space.json": JSON.stringify({
                space: { $type: "dimension", $extensions: { "com.example": { steps: 2 } } },
            }),
        };

        expect(setValue(opened(files, { generators: [steps] }), "space.1", 4)).toEqual({
            refusal: {
                kind: "generated",
                path: "space.1",
                from: "space",
                extension: ["com.example", "steps"],
                reason: expect.any(String),
            },
        });
    });

    it("is refused for a token a generator makes in any permutation, whichever the read built first", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: () => ({
                ok: true,
                value: [{ name: "1", $value: { value: 2, unit: "rem" } }],
            }),
        });
        for (const contexts of [
            { dark: [{ $ref: "./dark.json" }], light: [] },
            { light: [], dark: [{ $ref: "./dark.json" }] },
        ]) {
            const tokens = readFromMemory(
                {
                    files: {
                        "tokens.resolver.json": JSON.stringify({
                            version: "2025.10",
                            resolutionOrder: [
                                { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                                { type: "modifier", name: "mode", contexts },
                            ],
                        }),
                        "base.json": JSON.stringify({
                            space: {
                                "$type": "dimension",
                                "1": { $value: { value: 1, unit: "rem" } },
                            },
                        }),
                        "dark.json": JSON.stringify({
                            space: { $extensions: { "com.example": { steps: 1 } } },
                        }),
                    },
                    entryFile: "tokens.resolver.json",
                },
                { generators: [steps] },
            );
            expect(setValue(tokens, "space.1", { value: 3, unit: "rem" }).refusal).toMatchObject({
                kind: "generated",
                path: "space.1",
            });
        }
    });

    it('is refused for a token a generator makes at the top of a file, naming the top level, ""', () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: () => ({ ok: true, value: [{ name: "one", $value: 1 }] }),
        });
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./top.json" }]),
            "top.json": JSON.stringify({
                $type: "number",
                $extensions: { "com.example": { steps: 1 } },
            }),
        };

        const result = setValue(opened(files, { generators: [steps] }), "one", 2);
        expect(result).toEqual({
            refusal: {
                kind: "generated",
                path: "one",
                from: "",
                extension: ["com.example", "steps"],
                reason: expect.stringContaining("at the top of its file"),
            },
        });
    });

    it("is refused for a token a group inherits", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": JSON.stringify({
                button: { $type: "color", bg: { $value: "#ffffff" } },
                danger: { $extends: "{button}" },
            }),
        };

        expect(setValue(opened(files), "danger.bg", "#ff0000")).toEqual({
            refusal: {
                kind: "inherited",
                path: "danger.bg",
                from: "button",
                reason: expect.any(String),
            },
        });
    });
});

describe("setValue, at a place it is written", () => {
    const twoModifiers = () =>
        readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                        {
                            type: "modifier",
                            name: "mode",
                            default: "light",
                            contexts: { light: [], dark: [{ $ref: "./dark.json" }] },
                        },
                        {
                            type: "modifier",
                            name: "size",
                            default: "small",
                            contexts: { small: [], large: [{ $ref: "./large.json" }] },
                        },
                    ],
                }),
                "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
                "dark.json": '{ "bg": { "$type": "color", "$value": "#000000" } }',
                "large.json": '{ "bg": { "$type": "color", "$value": "#808080" } }',
            },
        });
    const placeIn = (tokens: DesignTokens, path: string, file: string) => {
        const place = tokens.getDefinitions(path).find(({ span }) => span.file === file);
        if (!place) throw new Error(`${path} is not written in ${file}`);
        return place;
    };

    it("changes the value written there, and names the permutations whose value comes from it", () => {
        const place = placeIn(demo, "color.text.brand", "dark.json");
        const result = setValue(demo, "color.text.brand", "{color.brand.200}", { at: place.span });

        expect(plainly(result)).toEqual({
            ops: [
                {
                    kind: "set",
                    file: "dark.json",
                    jsonPath: ["color", "text", "brand", "$value"],
                    value: "{color.brand.200}",
                    was: "{color.brand.300}",
                },
            ],
            affectedPermutations: place.winningPermutations.inputs,
            moves: [],
        });
        expect(place.winningPermutations.inputs).toEqual([{ mode: "dark" }]);
    });

    it("changes a file two modifiers' permutations read, which an input can't name, naming those whose value comes from it", () => {
        const tokens = twoModifiers();
        const place = placeIn(tokens, "bg", "dark.json");
        const result = setValue(tokens, "bg", "#111111", { at: place.span });

        expect(opsOf(result)).toEqual([
            {
                kind: "set",
                file: "dark.json",
                jsonPath: ["bg", "$value"],
                value: "#111111",
                was: "#000000",
            },
        ]);
        expect(result.ops && result.affectedPermutations.inputs).toEqual([
            { mode: "dark", size: "small" },
        ]);
        expect(
            setValue(tokens, "bg", "#111111", { input: { mode: "dark", size: "large" } }).refusal
                ?.kind,
        ).toBe("several-contexts");
    });

    it("takes a place by its file, offset and length, such as one a tool saved", () => {
        const place = placeIn(demo, "color.text.brand", "dark.json");
        const { file, offset, length } = place.span;
        const saved = { file, offset, length };

        expect(setValue(demo, "color.text.brand", "{color.brand.200}", { at: saved })).toEqual(
            setValue(demo, "color.text.brand", "{color.brand.200}", { at: place.span }),
        );
    });

    it("changes a place no permutation's value comes from, and says none sees it", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }, { $ref: "./brand.json" }]),
            "base.json": '{ "bg": { "$type": "color", "$value": "#ffffff" } }',
            "brand.json": '{ "bg": { "$type": "color", "$value": "#fafafa" } }',
        };
        const tokens = opened(files);
        const result = setValue(tokens, "bg", "#eeeeee", {
            at: placeIn(tokens, "bg", "base.json").span,
        });

        expect(plainly(result)).toEqual({
            ops: [
                {
                    kind: "set",
                    file: "base.json",
                    jsonPath: ["bg", "$value"],
                    value: "#eeeeee",
                    was: "#ffffff",
                },
            ],
            affectedPermutations: [],
            moves: [],
        });
    });

    it("is refused for a place where another token is written", () => {
        const other = placeIn(demo, "color.text.brand", "dark.json").span;

        expect(setValue(demo, "radius.md", 1, { at: other })).toEqual({
            refusal: {
                kind: "not-a-definition",
                path: "radius.md",
                at: other,
                reason: "`radius.md` isn't written at that place in `dark.json`; take the place from `getDefinitions`",
            },
        });
    });

    it("is refused for a place from an older read that no longer matches", () => {
        const before = placeIn(demo, "color.text.brand", "dark.json").span;
        const text = demo.getText("dark.json") ?? "";
        const moved = readFromMemory({
            files: { ...demo.toMemory().files, "dark.json": `\n${text}` },
            entryFile: "tokens.resolver.json",
        });

        expect(
            setValue(moved, "color.text.brand", "{color.brand.200}", { at: before }).refusal,
        ).toMatchObject({
            kind: "not-a-definition",
            path: "color.text.brand",
        });
    });

    it("is refused for a token that doesn't exist", () => {
        const other = placeIn(demo, "radius.md", "radius.json").span;

        expect(setValue(demo, "radius.nope", 1, { at: other }).refusal?.kind).toBe("not-found");
    });

    it("is refused for a token a generator makes, though its extension is a place", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: () => ({
                ok: true,
                value: [{ name: "1", $value: { value: 1, unit: "rem" } }],
            }),
        });
        const tokens = opened(
            {
                "tokens.resolver.json": resolver([{ $ref: "./space.json" }]),
                "space.json": JSON.stringify({
                    space: { $type: "dimension", $extensions: { "com.example": { steps: 1 } } },
                }),
            },
            { generators: [steps] },
        );
        const [place] = tokens.getDefinitions("space.1");

        expect(place).toBeDefined();
        expect(setValue(tokens, "space.1", 4, { at: place!.span }).refusal?.kind).toBe("generated");
    });

    it("is refused for a token a group inherits, though the token it inherits is a place", () => {
        const tokens = opened({
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": JSON.stringify({
                button: { $type: "color", bg: { $value: "#ffffff" } },
                danger: { $extends: "{button}" },
            }),
        });
        const [place] = tokens.getDefinitions("danger.bg");

        expect(place?.span).toEqual(tokens.getDefinitions("button.bg")[0]?.span);
        expect(setValue(tokens, "danger.bg", "#ff0000", { at: place!.span }).refusal).toMatchObject(
            {
                kind: "inherited",
                from: "button",
            },
        );
    });
});

describe("setDescription", () => {
    const onlyInContexts = (modifiers: object[], files: Record<string, string>) =>
        readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                        ...modifiers,
                    ],
                }),
                "base.json": "{}",
                ...files,
            },
            entryFile: "tokens.resolver.json",
        });
    const accent = JSON.stringify({ accent: { glow: { $type: "number", $value: 1 } } });

    it("writes a group's new description in the file read by the most permutations, when no file every permutation reads writes it", () => {
        const tokens = onlyInContexts(
            [
                {
                    type: "modifier",
                    name: "mode",
                    default: "light",
                    contexts: { light: [{ $ref: "./light.json" }], dark: [], dim: [] },
                },
                {
                    type: "modifier",
                    name: "density",
                    default: "comfy",
                    contexts: { comfy: [], compact: [{ $ref: "./compact.json" }] },
                },
            ],
            { "light.json": accent, "compact.json": accent },
        );
        expect(opsOf(setDescription(tokens, "accent", "Glow."))).toMatchObject([
            { kind: "add", file: "compact.json", jsonPath: ["accent", "$description"] },
        ]);
    });

    it("asks which file when the files that write a group are read by as many permutations", () => {
        const tokens = onlyInContexts(
            [
                {
                    type: "modifier",
                    name: "mode",
                    default: "light",
                    contexts: {
                        light: [],
                        dark: [{ $ref: "./dark.json" }],
                        dim: [{ $ref: "./dim.json" }],
                    },
                },
            ],
            { "dark.json": accent, "dim.json": accent },
        );
        const edit = setDescription(tokens, "accent", "Glow.");
        expect(edit.question).toMatchObject({
            kind: "placement",
            path: "accent",
            files: ["dark.json", "dim.json"],
        });
        expect(opsOf(edit.question?.answer("dim.json") ?? edit)).toMatchObject([
            { kind: "add", file: "dim.json", jsonPath: ["accent", "$description"] },
        ]);
    });

    it("writes a group's new description in a file every permutation reads, though a context's is read first", () => {
        const group = JSON.stringify({ accent: { glow: { $type: "number", $value: 1 } } });
        const tokens = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        {
                            type: "modifier",
                            name: "mode",
                            default: "light",
                            contexts: { light: [{ $ref: "./light.json" }], dark: [] },
                        },
                        { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                    ],
                }),
                "light.json": group,
                "base.json": group,
            },
            entryFile: "tokens.resolver.json",
        });
        expect(tokens.getDefinitions("accent").map(({ span }) => span.file)).toEqual([
            "light.json",
            "base.json",
        ]);
        expect(opsOf(setDescription(tokens, "accent", "Glow."))).toEqual([
            {
                kind: "add",
                file: "base.json",
                jsonPath: ["accent", "$description"],
                value: "Glow.",
            },
        ]);
    });

    it("describes a path that is a group in one permutation and a token in another as a token, where each is written", () => {
        const tokens = readFromMemory({
            files: {
                "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                    light: [],
                    dark: [{ $ref: "./dark.json" }],
                }),
                "base.json": JSON.stringify({ x: { y: { $type: "number", $value: 2 } } }),
                "dark.json": JSON.stringify({ x: { $type: "number", $value: 1 } }),
            },
            entryFile: "tokens.resolver.json",
        });
        expect(opsOf(setDescription(tokens, "x", "Both.")).map(({ file }) => file)).toEqual([
            "base.json",
            "dark.json",
        ]);
    });

    it("finds a group only one context writes, whichever permutation the read built first", () => {
        for (const contexts of [
            { dark: [{ $ref: "./dark.json" }], light: [] },
            { light: [], dark: [{ $ref: "./dark.json" }] },
        ]) {
            const tokens = readFromMemory({
                files: {
                    "tokens.resolver.json": JSON.stringify({
                        version: "2025.10",
                        resolutionOrder: [
                            { type: "set", name: "base", sources: [{ $ref: "./base.json" }] },
                            { type: "modifier", name: "mode", contexts },
                        ],
                    }),
                    "base.json": "{}",
                    "dark.json": JSON.stringify({
                        accent: { glow: { $type: "number", $value: 1 } },
                    }),
                },
                entryFile: "tokens.resolver.json",
            });
            expect(opsOf(setDescription(tokens, "accent", "Only in dark."))).toMatchObject([
                { kind: "add", file: "dark.json", jsonPath: ["accent", "$description"] },
            ]);
        }
    });

    it("changes a token's description", () => {
        const result = setDescription(demo, "color.brand.500", "The anchor.");

        expect(opsOf(result)).toEqual([
            {
                kind: "set",
                file: "color.json",
                jsonPath: ["color", "brand", "500", "$description"],
                value: "The anchor.",
                was: at(demo, "color.json", ["color", "brand", "500", "$description"]),
            },
        ]);
    });

    it("changes it in every file that writes the token, so every context keeps the same one", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }],
                dim: [{ $ref: "./dim.json" }],
            }),
            "base.json":
                '{ "bg": { "$type": "color", "$value": "#ffffff", "$description": "Old." } }',
            "dark.json":
                '{ "bg": { "$type": "color", "$value": "#000000", "$description": "Old." } }',
            "dim.json": '{ "bg": { "$type": "color", "$value": "#333333" } }',
        };
        const tokens = opened(files);
        const result = setDescription(tokens, "bg", "The page.");

        expect(opsOf(result)).toEqual([
            {
                kind: "set",
                file: "base.json",
                jsonPath: ["bg", "$description"],
                value: "The page.",
                was: "Old.",
            },
            {
                kind: "set",
                file: "dark.json",
                jsonPath: ["bg", "$description"],
                value: "The page.",
                was: "Old.",
            },
            { kind: "add", file: "dim.json", jsonPath: ["bg", "$description"], value: "The page." },
        ]);
        const after = committed(tokens, result);
        for (const mode of ["light", "dark", "dim"]) {
            expect(after.getPermutation({ mode }).getToken("bg")?.description).toBe("The page.");
        }
    });

    it("changes the description of a token only one context writes", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }], {
                light: [],
                dark: [{ $ref: "./dark.json" }],
            }),
            "base.json": "{}",
            "dark.json": '{ "glow": { "$type": "color", "$value": "#ffffff" } }',
        };

        expect(opsOf(setDescription(opened(files), "glow", "Halo."))).toEqual([
            { kind: "add", file: "dark.json", jsonPath: ["glow", "$description"], value: "Halo." },
        ]);
    });

    it("adds one to a token that has none", () => {
        const after = committed(demo, setDescription(demo, "color.brand.600", "Hover."));

        expect(after.getPermutation().getToken("color.brand.600")?.description).toBe("Hover.");
    });

    it("changes a group's description where the group writes it", () => {
        const after = committed(demo, setDescription(demo, "color.brand", "The house colour."));

        expect(at(after, "color.json", ["color", "brand", "$description"])).toBe(
            "The house colour.",
        );
    });

    it("changes a group's description in the file that writes it, when the group is in several", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }, { $ref: "./more.json" }]),
            "base.json": '{ "color": { "$type": "color", "a": { "$value": "#ffffff" } } }',
            "more.json": '{ "color": { "$description": "Old.", "b": { "$value": "#000000" } } }',
        };

        expect(plainly(setDescription(opened(files), "color", "New."))).toEqual({
            ops: [
                {
                    kind: "set",
                    file: "more.json",
                    jsonPath: ["color", "$description"],
                    value: "New.",
                    was: "Old.",
                },
            ],
            affectedPermutations: [],
            moves: [],
        });
    });

    it("removes one with null, and does nothing when there is none", () => {
        const after = committed(demo, setDescription(demo, "color.brand.500", null));

        expect(after.getPermutation().getToken("color.brand.500")?.description).toBeUndefined();
        expect(opsOf(setDescription(demo, "color.brand.600", null))).toEqual([]);
    });

    it("is refused for a path that is neither a token nor a group", () => {
        expect(setDescription(demo, "color.nope", "x")).toEqual({
            refusal: { kind: "not-found", path: "color.nope", reason: expect.any(String) },
        });
    });
});

describe("setValue, a part", () => {
    const smColor = ["shadow", "sm", "$value", "color"];

    it("changes one part of the shared value, leaving the others as written", () => {
        const result = setValue(demo, "shadow.sm", "{color.neutral.900}", { part: ["color"] });

        expect(opsOf(result)).toEqual([
            {
                kind: "set",
                file: "shadow.json",
                jsonPath: smColor,
                value: "{color.neutral.900}",
                was: at(demo, "shadow.json", smColor),
            },
        ]);
        const after = committed(demo, result);
        expect(at(after, "shadow.json", ["shadow", "sm", "$value", "blur"])).toEqual(
            at(demo, "shadow.json", ["shadow", "sm", "$value", "blur"]),
        );
    });

    it("changes a part of one layer of a list", () => {
        const second = ["shadow", "raised", "$value", 1, "offsetY"];

        const result = setValue(
            demo,
            "shadow.raised",
            { value: 10, unit: "px" },
            {
                part: [1, "offsetY"],
            },
        );

        expect(opsOf(result)).toEqual([
            {
                kind: "set",
                file: "shadow.json",
                jsonPath: second,
                value: { value: 10, unit: "px" },
                was: at(demo, "shadow.json", second),
            },
        ]);
    });

    it("adds a part the value doesn't write yet", () => {
        expect(opsOf(setValue(demo, "shadow.sm", true, { part: ["inset"] }))).toEqual([
            {
                kind: "add",
                file: "shadow.json",
                jsonPath: ["shadow", "sm", "$value", "inset"],
                value: true,
            },
        ]);
    });

    it("changes the part at the place given", () => {
        const dark = demo
            .getDefinitions("shadow.raised")
            .find(({ span }) => span.file === "dark.json")!;
        const color = ["shadow", "raised", "$value", 0, "color"];

        expect(
            opsOf(
                setValue(demo, "shadow.raised", "{color.neutral.50}", {
                    at: dark.span,
                    part: [0, "color"],
                }),
            ),
        ).toEqual([
            {
                kind: "set",
                file: "dark.json",
                jsonPath: color,
                value: "{color.neutral.50}",
                was: at(demo, "dark.json", color),
            },
        ]);
    });

    it("writes a new override as the value in force there, with the part changed", () => {
        const result = setValue(demo, "shadow.sm", "{color.neutral.50}", {
            input: { mode: "dark" },
            part: ["color"],
        });

        const after = committed(demo, result);
        expect(at(after, "dark.json", ["shadow", "sm", "$value"])).toEqual({
            ...(at(demo, "shadow.json", ["shadow", "sm", "$value"]) as object),
            color: "{color.neutral.50}",
        });
    });

    it("writes a part the type doesn't have, and the read reports it", () => {
        const after = committed(demo, setValue(demo, "shadow.sm", "red", { part: ["colour"] }));

        expect(at(after, "shadow.json", ["shadow", "sm", "$value", "colour"])).toBe("red");
        expect(after.getDiagnostics("shadow.sm").length).toBeGreaterThan(0);
    });

    it("refuses a part of a value that is a reference", () => {
        const files = {
            "tokens.resolver.json": resolver([{ $ref: "./base.json" }]),
            "base.json": JSON.stringify({
                shadow: {
                    $type: "shadow",
                    sm: {
                        $value: {
                            color: "#000000",
                            offsetX: { value: 0, unit: "px" },
                            offsetY: { value: 1, unit: "px" },
                            blur: { value: 2, unit: "px" },
                            spread: { value: 0, unit: "px" },
                        },
                    },
                    alias: { $value: "{shadow.sm}" },
                    layers: { $value: ["{shadow.sm}"] },
                },
            }),
        };
        const tokens = opened(files);

        expect(setValue(tokens, "shadow.alias", "#ffffff", { part: ["color"] })).toMatchObject({
            refusal: { kind: "part-in-reference", path: "shadow.alias", part: ["color"] },
        });
        expect(setValue(tokens, "shadow.layers", "#ffffff", { part: [0, "color"] })).toMatchObject({
            refusal: { kind: "part-in-reference", path: "shadow.layers", part: [0, "color"] },
        });
    });

    it("refuses a part the value can't hold", () => {
        for (const part of [
            [5, "color"],
            [1.5],
            [2],
            ["color", "colorSpace", "x"],
            ["offsetX", 0],
        ]) {
            expect(setValue(demo, "shadow.raised", 1, { part })).toMatchObject({
                refusal: { kind: "no-such-part", path: "shadow.raised", part },
            });
        }
        expect(setValue(demo, "shadow.sm", 1, { part: [0] })).toMatchObject({
            refusal: { kind: "no-such-part" },
        });
    });

    it("words each refusal", () => {
        const refusal = setValue(demo, "shadow.raised", 1, { part: [5, "color"] }).refusal;

        expect(refusal?.reason).toBe("`shadow.raised` has no part `5.color`");
    });
});
