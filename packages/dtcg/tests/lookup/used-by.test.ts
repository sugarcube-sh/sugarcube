import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const color = (value: unknown) => ({ $type: "color", $value: value });
const stop = (position: number) => ({ color: "{color.red}", position });

const tokens = readFromMemory({
    files: {
        "tokens.resolver.json": JSON.stringify({
            version: "2025.10",
            resolutionOrder: [
                { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
                {
                    type: "modifier",
                    name: "mode",
                    default: "light",
                    contexts: { light: [], dark: [{ $ref: "dark.json" }] },
                },
            ],
        }),
        "base.json": JSON.stringify({
            color: { red: color(red), brand: color("{color.red}"), text: color("{color.brand}") },
            fade: { $type: "gradient", $value: [stop(0), stop(1)] },
        }),
        "dark.json": JSON.stringify({
            color: { brand: color("{color.red}"), muted: color("{color.red}") },
        }),
    },
});

describe("permutation.usedBy", () => {
    it("gives each token that refers to the path in this permutation once, in referencedBy's order", () => {
        for (const permutation of tokens.permutations) {
            for (const chained of [false, true]) {
                const references = permutation.referencedBy("color.red", { chained });
                expect(permutation.usedBy("color.red", { chained })).toStrictEqual([
                    ...new Set(references.map(({ from }) => from)),
                ]);
            }
        }
        const dark = tokens.permutation({ mode: "dark" });
        expect(
            dark
                .usedBy("color.red")
                .map(({ path }) => path)
                .sort(),
        ).toStrictEqual(["color.brand", "color.muted", "fade"]);
        expect(
            dark.referencedBy("color.red").filter(({ from }) => from.path === "fade"),
        ).toHaveLength(2);
    });

    it("with chained, also each token that refers to one of those, in the order they are written", () => {
        const light = tokens.permutation();
        expect(light.usedBy("color.red", { chained: true }).map(({ path }) => path)).toStrictEqual([
            "color.brand",
            "color.text",
            "fade",
        ]);
    });

    it("is empty for a token nothing refers to", () => {
        expect(tokens.permutation().usedBy("color.text")).toStrictEqual([]);
    });
});
