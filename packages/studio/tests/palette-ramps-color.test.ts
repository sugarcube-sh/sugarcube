import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { PathIndex } from "../src/tokens/path-index";
import { paletteRamps } from "../src/tokens/palettes";
import { resolved } from "./fixtures";

const SCALE = { palettes: ["color.pink"] };

function ctxFor(map: ResolvedTokens) {
    return { pathIndex: new PathIndex(map), resolved: map, context: "default" };
}

function firstStepColor(map: ResolvedTokens) {
    return paletteRamps(SCALE, ctxFor(map))[0]?.steps[0]?.css;
}

describe("swatch colours", () => {
    it("converts a DTCG colour object to a CSS colour", () => {
        const map = resolved({
            path: "color.pink.500",
            type: "color",
            value: { colorSpace: "oklch", components: [0.656, 0.241, 354.308], alpha: 1 },
        });

        expect(firstStepColor(map)).toBe("oklch(0.656 0.241 354.308)");
    });

    it("passes a plain string value straight through", () => {
        const map = resolved({ path: "color.pink.500", type: "color", value: "#ec4899" });

        expect(firstStepColor(map)).toBe("#ec4899");
    });

    it("follows a reference to the colour it lands on", () => {
        const map = resolved(
            { path: "color.pink.500", type: "color", value: "{color.brand.base}" },
            { path: "color.brand.base", type: "color", value: "#ec4899" },
        );

        expect(firstStepColor(map)).toBe("#ec4899");
    });

    it("follows an edit rather than the snapshot the host loaded", () => {
        const edited = resolved({ path: "color.pink.500", type: "color", value: "#00ff00" });

        expect(firstStepColor(edited)).toBe("#00ff00");
    });

    it("is undefined when the chain doesn't end on a colour", () => {
        const map = resolved({ path: "color.pink.500", type: "color", value: "{color.missing}" });

        expect(firstStepColor(map)).toBeUndefined();
    });
});
