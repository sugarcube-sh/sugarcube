import { describe, expect, it } from "vitest";
import {
    currentPaletteFromReference,
    familyPaletteResetUpdates,
    familyPaletteSwapUpdates,
} from "../src/tokens/palette";
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

    it("ignores a reference to a standalone colour, and reads the ramp instead", () => {
        // The fluid kit's shape: the family's first token pins a surface to white, which is
        // itself a declared palette. First-match-wins used to report the family as "white".
        const { pathIndex, readToken } = setup(
            { path: "color.neutral.surface.default", value: "{color.white}", type: "color" },
            { path: "color.neutral.text.normal", value: "{color.neutral.900}", type: "color" },
            { path: "color.white", value: "#FFFFFF", type: "color" },
        );

        expect(
            currentPaletteFromReference(
                readToken,
                "color.neutral",
                ["neutral", "rose", "white"],
                pathIndex,
            ),
        ).toBe("neutral");
    });

    it("returns undefined when the family's tokens disagree", () => {
        // One surface repointed at another palette. Reading the first reference found used to
        // report the whole family as red.
        const { pathIndex, readToken } = setup(
            { path: "color.neutral.surface.default", value: "{color.red.100}", type: "color" },
            { path: "color.neutral.text.normal", value: "{color.neutral.900}", type: "color" },
        );

        expect(
            currentPaletteFromReference(readToken, "color.neutral", ["neutral", "red"], pathIndex),
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
    it("leaves a standalone colour alone", () => {
        // {color.white} named the palette itself, so the old code rewrote it to {color.rose}
        // - a group, not a token, and a dangling reference in the saved file. A white surface
        // is a fixed decision; changing the family's hue shouldn't tint it.
        const { pathIndex, readToken } = setup(
            { path: "color.neutral.surface.default", value: "{color.white}", type: "color" },
            { path: "color.neutral.text.normal", value: "{color.neutral.900}", type: "color" },
            { path: "color.white", value: "#FFFFFF", type: "color" },
        );

        const updates = familyPaletteSwapUpdates(
            "color.neutral",
            "rose",
            ["neutral", "rose", "white"],
            readToken,
            pathIndex,
        );

        expect(updates).toEqual([
            { path: "color.neutral.text.normal", value: "{color.rose.900}", context: "default" },
        ]);
    });

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

describe("familyPaletteResetUpdates", () => {
    function twoContexts(current: string, baselinePalette: string) {
        const build = (palette: string) =>
            resolved(
                {
                    path: "color.neutral.text.normal",
                    value: `{color.${palette}.900}`,
                    type: "color",
                    context: "perm:0",
                },
                {
                    path: "color.neutral.text.normal",
                    value: `{color.${palette}.300}`,
                    type: "color",
                    context: "perm:1",
                },
            );

        const currentMap = build(current);
        const baselineMap = build(baselinePalette);
        const pathIndex = new PathIndex(currentMap);
        return {
            pathIndex,
            readCurrent: ((path, ctx) => pathIndex.readValue(currentMap, path, ctx)) as TokenReader,
            readBaseline: ((path, ctx) =>
                pathIndex.readValue(baselineMap, path, ctx)) as TokenReader,
        };
    }

    it("puts every context back, not just the one being viewed", () => {
        const { pathIndex, readCurrent, readBaseline } = twoContexts("amber", "neutral");

        const plan = familyPaletteResetUpdates(
            "color.neutral",
            ["neutral", "amber"],
            readCurrent,
            readBaseline,
            pathIndex,
            "perm:0",
        );

        expect(plan.overridden).toBe(true);
        expect(plan.updates).toEqual([
            {
                path: "color.neutral.text.normal",
                value: "{color.neutral.900}",
                context: "perm:0",
            },
            {
                path: "color.neutral.text.normal",
                value: "{color.neutral.300}",
                context: "perm:1",
            },
        ]);
    });

    it("reports nothing to undo when the family is still on its authored palette", () => {
        const { pathIndex, readCurrent, readBaseline } = twoContexts("neutral", "neutral");

        const plan = familyPaletteResetUpdates(
            "color.neutral",
            ["neutral", "amber"],
            readCurrent,
            readBaseline,
            pathIndex,
            "perm:0",
        );

        expect(plan).toEqual({ overridden: false, updates: [] });
    });

    it("offers no reset when the authored family had no single palette to return to", () => {
        const map = resolved(
            { path: "color.neutral.text.normal", value: "{color.amber.900}", type: "color" },
            { path: "color.neutral.text.quiet", value: "{color.amber.600}", type: "color" },
        );
        const baselineMap = resolved(
            { path: "color.neutral.text.normal", value: "{color.neutral.900}", type: "color" },
            { path: "color.neutral.text.quiet", value: "{color.rose.600}", type: "color" },
        );
        const pathIndex = new PathIndex(map);

        const plan = familyPaletteResetUpdates(
            "color.neutral",
            ["neutral", "amber", "rose"],
            (path, ctx) => pathIndex.readValue(map, path, ctx),
            (path, ctx) => pathIndex.readValue(baselineMap, path, ctx),
            pathIndex,
        );

        expect(plan).toEqual({ overridden: false, updates: [] });
    });
});
