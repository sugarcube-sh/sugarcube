import { describe, expect, it } from "vitest";
import { currentPaletteFromReference, familyPaletteSwapUpdates } from "../src/tokens/palette";
import { PathIndex } from "../src/tokens/path-index";
import type { TokenReader } from "../src/tokens/types";
import { resolved } from "./fixtures";

function setup(...fixtures: Parameters<typeof resolved>) {
    const map = resolved(...fixtures);
    const pathIndex = new PathIndex(map);
    const readToken: TokenReader = (path, ctx) => pathIndex.readValue(map, path, ctx);
    return { pathIndex, readToken };
}

describe("currentPaletteFromReference", () => {
    it("returns the palette name when a family token references it", () => {
        const { pathIndex, readToken } = setup(
            { path: "color.base.500", value: "{color.blue.500}", type: "color" },
            { path: "color.blue.500", value: "#0000ff", type: "color" },
        );

        expect(
            currentPaletteFromReference(readToken, "color.base", ["blue", "red"], pathIndex),
        ).toBe("blue");
    });

    it("returns undefined when no family token references a palette in the set", () => {
        const { pathIndex, readToken } = setup({
            path: "color.base.500",
            value: "{color.green.500}",
            type: "color",
        });

        expect(
            currentPaletteFromReference(readToken, "color.base", ["blue", "red"], pathIndex),
        ).toBeUndefined();
    });

    it("returns undefined when the family has no tokens", () => {
        const { pathIndex, readToken } = setup();

        expect(
            currentPaletteFromReference(readToken, "color.base", ["blue"], pathIndex),
        ).toBeUndefined();
    });

    it("skips tokens whose value is a literal and reports the palette from the first ref token", () => {
        const { pathIndex, readToken } = setup(
            { path: "color.base.100", value: "#ffffff", type: "color" },
            { path: "color.base.500", value: "{color.blue.500}", type: "color" },
        );

        expect(currentPaletteFromReference(readToken, "color.base", ["blue"], pathIndex)).toBe(
            "blue",
        );
    });
});

describe("familyPaletteSwapUpdates", () => {
    it("emits one update per family token, replacing the palette segment", () => {
        const { pathIndex, readToken } = setup(
            { path: "color.base.500", value: "{color.blue.500}", type: "color" },
            { path: "color.base.900", value: "{color.blue.900}", type: "color" },
            { path: "color.blue.500", value: "#0000ff", type: "color" },
        );

        const updates = familyPaletteSwapUpdates(
            "color.base",
            "red",
            ["blue", "red"],
            readToken,
            pathIndex,
        );

        expect(updates.sort((a, b) => a.path.localeCompare(b.path))).toEqual([
            { path: "color.base.500", value: "{color.red.500}", context: "default" },
            { path: "color.base.900", value: "{color.red.900}", context: "default" },
        ]);
    });

    it("skips family tokens whose value is a literal", () => {
        const { pathIndex, readToken } = setup({
            path: "color.base.500",
            value: "#abcdef",
            type: "color",
        });

        const updates = familyPaletteSwapUpdates(
            "color.base",
            "red",
            ["blue", "red"],
            readToken,
            pathIndex,
        );

        expect(updates).toEqual([]);
    });

    it("skips family tokens whose reference doesn't contain a palette segment", () => {
        const { pathIndex, readToken } = setup({
            path: "color.base.500",
            value: "{color.green.500}",
            type: "color",
        });

        const updates = familyPaletteSwapUpdates(
            "color.base",
            "red",
            ["blue", "red"],
            readToken,
            pathIndex,
        );

        expect(updates).toEqual([]);
    });

    it("emits an update for each permutation context the family token has", () => {
        const { pathIndex, readToken } = setup(
            {
                path: "color.base.500",
                value: "{color.blue.500}",
                type: "color",
                context: "light",
            },
            {
                path: "color.base.500",
                value: "{color.blue.500}",
                type: "color",
                context: "dark",
            },
        );

        const updates = familyPaletteSwapUpdates(
            "color.base",
            "red",
            ["blue", "red"],
            readToken,
            pathIndex,
        );

        const flat = updates.map((u) => `${u.path}|${u.context}|${u.value}`).sort();
        expect(flat).toEqual([
            "color.base.500|dark|{color.red.500}",
            "color.base.500|light|{color.red.500}",
        ]);
    });
});
