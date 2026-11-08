import { describe, expect, it } from "vitest";
import { defineGenerator, readFromMemory, type Span } from "../../src/index.js";
import { getSpan } from "../../src/editor.js";
import { lightDark, oneFile, oneSet } from "../token-files.js";

const color = (hex: string) => `{ "$type": "color", "$value": "${hex}" }`;

const resolver = lightDark(["./base.json", "./brand.json"], ["./dark.json"]);

const files = {
    "tokens.resolver.json": resolver,
    "base.json": `{ "bg": ${color("#ffffff")}, "fg": ${color("#000000")} }`,
    "brand.json": `{ "bg": ${color("#fafafa")} }`,
    "dark.json": `{ "bg": ${color("#111111")} }`,
};
const tokens = readFromMemory({ files });

const written = (span: Span) =>
    files[span.file as keyof typeof files].slice(span.offset, span.offset + span.length);

describe("a token's definitions, across sources", () => {
    it("lists every place its sources write it, in order, the one that wins last", () => {
        const light = tokens.getPermutation().getToken("bg");
        const dark = tokens.getPermutation({ mode: "dark" }).getToken("bg");

        expect(light?.definitions.map((place) => getSpan(tokens, place).file)).toStrictEqual([
            "base.json",
            "brand.json",
        ]);
        expect(light?.definitions[0] && written(getSpan(tokens, light.definitions[0]))).toBe(
            color("#ffffff"),
        );
        expect(dark?.definitions.map((place) => getSpan(tokens, place).file)).toStrictEqual([
            "base.json",
            "brand.json",
            "dark.json",
        ]);
    });

    it("gives a group written in two files both places, each with the source that writes it", () => {
        const twice = readFromMemory({
            files: {
                ...files,
                "base.json": `{ "brand": { "a": ${color("#000000")} } }`,
                "brand.json": `{ "brand": { "b": ${color("#ffffff")} } }`,
            },
        });
        const places = twice.getPermutation().getGroup("brand")?.definitions ?? [];

        expect(places.map(({ source }) => source.file)).toStrictEqual(["base.json", "brand.json"]);
        expect(places.map((place) => getSpan(twice, place).file)).toStrictEqual([
            "base.json",
            "brand.json",
        ]);
    });

    it("says which of the permutation's sources writes each place", () => {
        const sources = tokens.getPermutation({ mode: "dark" }).sources ?? [];
        const dark = tokens.getPermutation({ mode: "dark" }).getToken("bg");
        const winner = dark?.definitions.at(-1);

        expect(dark?.definitions.every(({ source }) => sources.includes(source))).toBe(true);
        expect(winner?.source.modifier?.name).toBe("mode");
        expect(winner?.source.sets).toStrictEqual([]);
    });

    it("is one place for a token written once", () => {
        expect(tokens.getPermutation().getToken("fg")?.definitions).toHaveLength(1);
    });

    it("is where an inherited token's value is written, not every place the group it comes from is", () => {
        const extended = readFromMemory({
            files: {
                "tokens.resolver.json": oneSet("./a.json", "./b.json"),
                "a.json": JSON.stringify({ button: { $type: "color", bg: { $value: "#ffffff" } } }),
                "b.json": JSON.stringify({
                    button: { bg: { $value: "#eeeeee" } },
                    danger: { $extends: "{button}" },
                }),
            },
        });

        expect(extended.getPermutation().getToken("button.bg")?.definitions).toHaveLength(2);
        expect(
            extended
                .getPermutation()
                .getToken("danger.bg")
                ?.definitions.map((place) => getSpan(extended, place).file),
        ).toStrictEqual(["b.json"]);
    });

    it("is the extension that makes a token a generator adds, which no file writes", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: () => ({ ok: true, value: [{ name: "1", $value: 1 }] }),
        });
        const generated = oneFile(
            { space: { $type: "number", $extensions: { "com.example": { steps: 1 } } } },
            { generators: [steps] },
        );

        expect(generated.getPermutation().getToken("space.1")?.definitions).toHaveLength(1);
        expect(generated.getPermutation().getToken("space.1")?.generated).toStrictEqual({
            from: "space",
            extension: ["com.example", "steps"],
        });
    });
});

describe("readFromMemory", () => {
    it("takes an entry left undefined as no entry", () => {
        const loose = { "tokens.json": `{ "bg": ${color("#ffffff")} }` };
        const entryFile: string | undefined = undefined;

        expect(readFromMemory({ files: loose, entryFile }).files).toStrictEqual(["tokens.json"]);
    });
});

describe("a source written in the resolver", () => {
    it("is part of the resolver, so it has a pointer to where its tokens sit", () => {
        const inline = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        {
                            type: "set",
                            name: "base",
                            sources: [
                                { $ref: "./base.json" },
                                { bg: { $type: "color", $value: "#fff" } },
                            ],
                        },
                    ],
                }),
                "base.json": "{}",
            },
        });

        expect(inline.permutations[0]?.sources).toEqual([
            { file: "base.json", sets: [{ name: "base" }], readBy: "every-context" },
            {
                file: "tokens.resolver.json",
                pointer: "#/resolutionOrder/0/sources/1",
                sets: [{ name: "base" }],
                readBy: "every-context",
            },
        ]);
    });
});
