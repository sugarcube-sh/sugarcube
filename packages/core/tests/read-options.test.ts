import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readFromMemory } from "@sugarcube-sh/dtcg";
import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { readOptions } from "../src/shared/read-options.js";

const resolver = JSON.stringify({
    version: "2025.10",
    sets: { base: { sources: [{ $ref: "base.json" }] } },
    modifiers: {
        theme: { contexts: { light: [], dark: [{ $ref: "dark.json" }] }, default: "light" },
        brand: { contexts: { house: [], ocean: [] }, default: "house" },
    },
    resolutionOrder: [
        { $ref: "#/sets/base" },
        { $ref: "#/modifiers/theme" },
        { $ref: "#/modifiers/brand" },
    ],
});

const files = {
    "tokens.resolver.json": resolver,
    "base.json": JSON.stringify({ color: { $type: "color", brand: { $value: "#e11d48" } } }),
    "dark.json": JSON.stringify({ color: { brand: { $value: "#fb7185" } } }),
};

function readWith(variables?: Parameters<typeof fillDefaults>[0]["variables"]) {
    const config = fillDefaults({
        resolver: "tokens.resolver.json",
        ...(variables && { variables }),
    });
    const tokens = readFromMemory(
        { files, entryFile: "tokens.resolver.json" },
        readOptions(config),
    );
    return { tokens, inputs: tokens.permutations.map(({ input }) => input) };
}

describe("readOptions", () => {
    it("reads the default and each context on its own when the config lists no permutations", () => {
        expect(readWith().inputs).toStrictEqual([
            { theme: "light", brand: "house" },
            { theme: "dark", brand: "house" },
            { theme: "light", brand: "ocean" },
        ]);
    });

    it("reads exactly the permutations the config lists, a combined one included", () => {
        const { inputs } = readWith({
            permutations: [
                { input: {}, selector: ":root" },
                { input: { theme: "dark", brand: "ocean" }, selector: ".dark.ocean" },
            ],
        });
        expect(inputs).toStrictEqual([
            { theme: "light", brand: "house" },
            { theme: "dark", brand: "ocean" },
        ]);
    });

    it("reads a hex-string color as sRGB, keeping the hex", () => {
        const brand = readWith().tokens.permutations[0]?.tokens[0];
        expect(brand?.resolved).toMatchObject({ colorSpace: "srgb", hex: "#e11d48" });
    });

    it("makes the steps a scale recipe asks for", () => {
        const recipe = readFileSync(
            join(import.meta.dirname, "../../../apps/www/registry/tokens/recipes/size-demo.json"),
            "utf8",
        );
        const config = fillDefaults({ resolver: "size-demo.json" });
        const tokens = readFromMemory({ files: { "size-demo.json": recipe } }, readOptions(config));
        const made = tokens.permutations[0]?.tokens.filter(({ generated }) => generated);
        expect(made?.length).toBe(13);
        expect(made?.every(({ generated }) => generated?.from === "size.step")).toBe(true);
    });
});
