import { describe, expect, it } from "vitest";
import { open } from "../src/index.js";

const resolver = JSON.stringify({
    version: "2025.10",
    sets: { base: { sources: [{ $ref: "base.json" }, { $ref: "../shared/brand.json" }] } },
    resolutionOrder: [{ $ref: "#/sets/base" }],
});
const base = '{ "space": { "$type": "dimension", "$value": { "value": 4, "unit": "px" } } }';
const brand = '{ "color": { "$type": "color", "$value": "#e11d48" } }';

const disk: Record<string, string> = {
    "tokens/design.resolver.json": resolver,
    "tokens/base.json": base,
    "shared/brand.json": brand,
};

describe("open", () => {
    it("keeps each file's text by the name the Document gives it", async () => {
        const project = await open("tokens/design.resolver.json", {
            readText: async (path) => disk[path] ?? Promise.reject(new Error("missing")),
        });
        expect(project.doc.files).toStrictEqual([
            "design.resolver.json",
            "base.json",
            "../shared/brand.json",
        ]);
        expect(project.files).toStrictEqual({
            "design.resolver.json": resolver,
            "base.json": base,
            "../shared/brand.json": brand,
        });
    });

    it("remembers the options it was read with, without the way it read files", async () => {
        const project = await open("tokens/design.resolver.json", {
            readText: async (path) => disk[path] ?? Promise.reject(new Error("missing")),
            hexStringColors: true,
        });
        expect(project.options).toStrictEqual({ hexStringColors: true });
        expect(project.doc.diagnostics).toStrictEqual([]);
    });

    it("leaves out a file that could not be read, as the Document reports it", async () => {
        const project = await open("tokens/design.resolver.json", {
            readText: async (path) =>
                path === "shared/brand.json"
                    ? Promise.reject(new Error("gone"))
                    : (disk[path] ?? ""),
        });
        expect(Object.keys(project.files)).toStrictEqual(["design.resolver.json", "base.json"]);
        expect(project.doc.diagnostics.map(({ kind }) => kind)).toStrictEqual(["file-not-found"]);
    });
});
