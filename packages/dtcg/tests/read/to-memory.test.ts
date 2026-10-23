import { describe, expect, it } from "vitest";
import { read, readFromMemory } from "../../src/index.js";

const resolver = JSON.stringify({
    version: "2025.10",
    sets: { base: { sources: [{ $ref: "base.json" }, { $ref: "../shared/brand.json" }] } },
    resolutionOrder: [{ $ref: "#/sets/base" }],
});
const base = '{ "space": { "$type": "dimension", "$value": { "value": 4, "unit": "px" } } }';
const brand = '{ "color": { "$type": "color", "$value": "#e11d48" } }';
const dark = '{ "color": { "$type": "color", "$value": "#9f1239" } }';
const localResolver = JSON.stringify({
    version: "2025.10",
    sets: { base: { sources: [{ $ref: "base.json" }] } },
    resolutionOrder: [{ $ref: "#/sets/base" }],
});

const disk: Record<string, string> = {
    "tokens/design.resolver.json": resolver,
    "tokens/base.json": base,
    "shared/brand.json": brand,
};

const fromDisk = async (path: string) => disk[path];

describe("tokens.entry", () => {
    it("is the file the read started from, by the name the design tokens give it", async () => {
        const tokens = await read("tokens/design.resolver.json", { readText: fromDisk });
        expect(tokens.entry).toBe("design.resolver.json");
        expect(tokens.text(tokens.entry)).toBe(resolver);
    });

    it("is the one file read without a resolver", () => {
        expect(readFromMemory({ files: { "base.json": base } }).entry).toBe("base.json");
    });

    it("is the resolver found among loose files", () => {
        const tokens = readFromMemory({
            files: { "base.json": base, "design.resolver.json": localResolver },
        });
        expect(tokens.entry).toBe("design.resolver.json");
    });
});

describe("tokens.toMemory", () => {
    it("gives the entry and each file's text, by the name the design tokens give it", async () => {
        const tokens = await read("tokens/design.resolver.json", { readText: fromDisk });
        expect(tokens.toMemory()).toStrictEqual({
            entry: "design.resolver.json",
            files: {
                "design.resolver.json": resolver,
                "base.json": base,
                "../shared/brand.json": brand,
            },
        });
    });

    it("leaves out a file the read did not use", () => {
        const tokens = readFromMemory({
            files: { ...disk, "tokens/unused.json": dark },
            entry: "tokens/design.resolver.json",
        });
        expect(Object.keys(tokens.toMemory().files)).toStrictEqual([
            "design.resolver.json",
            "base.json",
            "../shared/brand.json",
        ]);
    });

    it("leaves out a file that is not there, as the design tokens report it", async () => {
        const tokens = await read("tokens/design.resolver.json", {
            readText: async (path) => (path === "shared/brand.json" ? undefined : disk[path]),
        });
        expect(Object.keys(tokens.toMemory().files)).toStrictEqual([
            "design.resolver.json",
            "base.json",
        ]);
        expect(tokens.diagnostics.map(({ kind }) => kind)).toStrictEqual(["file-not-found"]);
    });

    it("reads again, with the same options, to the same design tokens", async () => {
        const options = { hexStringColors: true };
        const tokens = await read("tokens/design.resolver.json", {
            readText: fromDisk,
            ...options,
        });
        expect(readFromMemory(tokens.toMemory(), options)).toStrictEqual(tokens);
    });

    it("reads again to the same design tokens when one token file is the entry", () => {
        const tokens = readFromMemory({ files: { "base.json": base } });
        expect(readFromMemory(tokens.toMemory())).toStrictEqual(tokens);
    });
});
