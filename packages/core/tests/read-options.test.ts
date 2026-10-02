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

function labelsRead(variables?: Parameters<typeof fillDefaults>[0]["variables"]) {
    const config = fillDefaults({
        resolver: "tokens.resolver.json",
        ...(variables && { variables }),
    });
    const doc = readFromMemory({ files, entry: "tokens.resolver.json" }, readOptions(config));
    return { doc, labels: doc.permutations.map(({ label }) => label) };
}

describe("readOptions", () => {
    it("reads the default and each context on its own when the config lists no permutations", () => {
        expect(labelsRead().labels).toStrictEqual(["default", "dark", "ocean"]);
    });

    it("reads exactly the permutations the config lists, a combined one included", () => {
        const { labels } = labelsRead({
            permutations: [
                { input: {}, selector: ":root" },
                { input: { theme: "dark", brand: "ocean" }, selector: ".dark.ocean" },
            ],
        });
        expect(labels).toStrictEqual(["default", "dark + ocean"]);
    });

    it("reads a hex-string color as sRGB, keeping the hex", () => {
        const brand = labelsRead().doc.permutations[0]?.tokens[0];
        expect(brand?.resolved).toMatchObject({ colorSpace: "srgb", hex: "#e11d48" });
    });

    it("makes the steps a scale recipe asks for", () => {
        const recipe = readFileSync(
            join(import.meta.dirname, "../../../apps/www/registry/tokens/recipes/size-demo.json"),
            "utf8",
        );
        const config = fillDefaults({ resolver: "size-demo.json" });
        const doc = readFromMemory({ files: { "size-demo.json": recipe } }, readOptions(config));
        const made = doc.permutations[0]?.tokens.filter(({ generated }) => generated);
        expect(made?.length).toBe(13);
        expect(made?.every(({ generated }) => generated?.from === "size.step")).toBe(true);
    });
});
