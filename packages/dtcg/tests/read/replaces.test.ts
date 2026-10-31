import { describe, expect, it } from "vitest";
import { defineGenerator, readFromMemory, type Span } from "../../src/index.js";

const color = (hex: string) => `{ "$type": "color", "$value": "${hex}" }`;

const resolver = JSON.stringify({
    version: "2025.10",
    resolutionOrder: [
        { type: "set", name: "base", sources: [{ $ref: "./base.json" }, { $ref: "./brand.json" }] },
        {
            type: "modifier",
            name: "mode",
            default: "light",
            contexts: { light: [], dark: [{ $ref: "./dark.json" }] },
        },
    ],
});

const files = {
    "tokens.resolver.json": resolver,
    "base.json": `{ "bg": ${color("#ffffff")}, "fg": ${color("#000000")} }`,
    "brand.json": `{ "bg": ${color("#fafafa")} }`,
    "dark.json": `{ "bg": ${color("#111111")} }`,
};
const tokens = readFromMemory({ files, entry: "tokens.resolver.json" });

const written = (span: Span) =>
    files[span.file as keyof typeof files].slice(span.offset, span.offset + span.length);

describe("a token's writtenAt, across sources", () => {
    it("lists every place its sources write it, in order, the one that wins last", () => {
        const light = tokens.permutation().token("bg");
        const dark = tokens.permutation({ mode: "dark" }).token("bg");

        expect(light?.writtenAt.map((place) => tokens.spanOf(place).file)).toStrictEqual([
            "base.json",
            "brand.json",
        ]);
        expect(light?.writtenAt[0] && written(tokens.spanOf(light.writtenAt[0]))).toBe(
            color("#ffffff"),
        );
        expect(dark?.writtenAt.map((place) => tokens.spanOf(place).file)).toStrictEqual([
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
            entry: "tokens.resolver.json",
        });
        const places = twice.permutation().group("brand")?.writtenAt ?? [];

        expect(places.map(({ source }) => source.file)).toStrictEqual(["base.json", "brand.json"]);
        expect(places.map((place) => twice.spanOf(place).file)).toStrictEqual([
            "base.json",
            "brand.json",
        ]);
    });

    it("says which of the permutation's sources writes each place", () => {
        const sources = tokens.permutation({ mode: "dark" }).sources ?? [];
        const dark = tokens.permutation({ mode: "dark" }).token("bg");
        const winner = dark?.writtenAt.at(-1);

        expect(dark?.writtenAt.every(({ source }) => sources.includes(source))).toBe(true);
        expect(winner?.source.modifier?.name).toBe("mode");
        expect(winner?.source.sets).toStrictEqual([]);
    });

    it("is one place for a token written once", () => {
        expect(tokens.permutation().token("fg")?.writtenAt).toHaveLength(1);
    });

    it("is where an inherited token's value is written, not every place the group it comes from is", () => {
        const extended = readFromMemory({
            files: {
                "tokens.resolver.json": JSON.stringify({
                    version: "2025.10",
                    resolutionOrder: [
                        {
                            type: "set",
                            name: "base",
                            sources: [{ $ref: "./a.json" }, { $ref: "./b.json" }],
                        },
                    ],
                }),
                "a.json": JSON.stringify({ button: { $type: "color", bg: { $value: "#ffffff" } } }),
                "b.json": JSON.stringify({
                    button: { bg: { $value: "#eeeeee" } },
                    danger: { $extends: "{button}" },
                }),
            },
            entry: "tokens.resolver.json",
        });

        expect(extended.permutation().token("button.bg")?.writtenAt).toHaveLength(2);
        expect(
            extended
                .permutation()
                .token("danger.bg")
                ?.writtenAt.map((place) => extended.spanOf(place).file),
        ).toStrictEqual(["b.json"]);
    });

    it("is the extension that makes a token a generator adds, which no file writes", () => {
        const steps = defineGenerator({
            extension: ["com.example", "steps"],
            generate: () => ({ ok: true, value: [{ name: "1", $value: 1 }] }),
        });
        const generated = readFromMemory(
            {
                files: {
                    "tokens.json": JSON.stringify({
                        space: { $type: "number", $extensions: { "com.example": { steps: 1 } } },
                    }),
                },
            },
            { generators: [steps] },
        );

        expect(generated.permutation().token("space.1")?.writtenAt).toHaveLength(1);
        expect(generated.permutation().token("space.1")?.generated).toStrictEqual({
            from: "space",
            extension: ["com.example", "steps"],
        });
    });
});

describe("readFromMemory", () => {
    it("takes an entry left undefined as no entry", () => {
        const loose = { "tokens.json": `{ "bg": ${color("#ffffff")} }` };
        const entry: string | undefined = undefined;

        expect(readFromMemory({ files: loose, entry }).files).toStrictEqual(["tokens.json"]);
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
            entry: "tokens.resolver.json",
        });

        expect(inline.permutations[0]?.sources).toEqual([
            { file: "base.json", sets: [{ name: "base" }], readBy: "everyone" },
            {
                file: "tokens.resolver.json",
                pointer: "#/resolutionOrder/0/sources/1",
                sets: [{ name: "base" }],
                readBy: "everyone",
            },
        ]);
    });
});
