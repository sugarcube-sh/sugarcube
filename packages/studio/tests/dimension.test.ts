import type { ResolvedToken, ResolvedTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { cssLengthFor, dimensionAt, isDimension, lengthOf } from "../src/tokens/dimension";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

function reader(map: ResolvedTokens) {
    const pathIndex = new PathIndex(map);
    return (path: string) => pathIndex.readValue(map, path);
}

function tokenAt(map: ResolvedTokens, path: string): ResolvedToken {
    return new PathIndex(map).readToken(map, path) as ResolvedToken;
}

describe("isDimension", () => {
    it("accepts a value and unit", () => {
        expect(isDimension({ value: 1, unit: "rem" })).toBe(true);
    });

    it("rejects anything else", () => {
        expect(isDimension({ value: "1", unit: "rem" })).toBe(false);
        expect(isDimension({ min: 1, max: 2 })).toBe(false);
        expect(isDimension("1rem")).toBe(false);
        expect(isDimension(null)).toBe(false);
    });
});

describe("cssLengthFor", () => {
    it("draws a literal dimension", () => {
        const map = resolved({ path: "space.md", value: { value: 1.5, unit: "rem" } });

        expect(cssLengthFor("space.md", reader(map))).toBe("1.5rem");
    });

    it("follows a chain to whatever holds the value", () => {
        const map = resolved(
            { path: "heading.1", value: "{text.4xl}" },
            { path: "text.4xl", value: "{size.step.5}" },
            { path: "size.step.5", value: { value: 3, unit: "rem" } },
        );

        expect(cssLengthFor("heading.1", reader(map))).toBe("3rem");
    });

    it("reflects an edit made several hops away", () => {
        const before = resolved(
            { path: "heading.1", value: "{text.4xl}" },
            { path: "text.4xl", value: "{size.step.5}" },
            { path: "size.step.5", value: { value: 3, unit: "rem" } },
        );
        const after = resolved(
            { path: "heading.1", value: "{text.4xl}" },
            { path: "text.4xl", value: "{size.step.5}" },
            { path: "size.step.5", value: { value: 4, unit: "rem" } },
        );
        const pathIndex = new PathIndex(before);
        const read = (path: string) => pathIndex.readValue(after, path);

        expect(cssLengthFor("heading.1", read)).toBe("4rem");
    });

    it("draws a zero step, which still has to be visible", () => {
        const map = resolved({ path: "space.0", value: { value: 0, unit: "rem" } });

        expect(cssLengthFor("space.0", reader(map))).toBe("0rem");
    });
});

describe("lengthOf", () => {
    it("refuses a duration, which is a dimension but not a width", () => {
        const map = resolved({
            path: "transition.fast",
            type: "duration",
            value: { value: 75, unit: "ms" },
        });

        expect(lengthOf(tokenAt(map, "transition.fast"), reader(map))).toBeUndefined();
    });

    it("refuses a colour", () => {
        const map = resolved({ path: "color.brand.500", type: "color", value: "#4d7bd9" });

        expect(lengthOf(tokenAt(map, "color.brand.500"), reader(map))).toBeUndefined();
    });

    it("draws a dimension that points at another one", () => {
        const map = resolved(
            { path: "panel.radius", value: "{radius.lg}" },
            { path: "radius.lg", value: { value: 1, unit: "rem" } },
        );

        expect(lengthOf(tokenAt(map, "panel.radius"), reader(map))).toBe("1rem");
    });
});

describe("dimensionAt", () => {
    it("returns the parts, so a caller can compare sizes", () => {
        const map = resolved({ path: "space.md", value: { value: 2, unit: "rem" } });

        expect(dimensionAt("space.md", reader(map))).toEqual({ value: 2, unit: "rem" });
    });

    it("is undefined for a fluid pair that has not been resolved", () => {
        const map = resolved({
            path: "space.md",
            value: { min: { value: 1, unit: "rem" }, max: { value: 2, unit: "rem" } },
        });

        expect(dimensionAt("space.md", reader(map))).toBeUndefined();
    });
});
