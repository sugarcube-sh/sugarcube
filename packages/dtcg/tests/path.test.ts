import { describe, expect, it } from "vitest";
import { pathBelow, withoutRoot } from "../src/index.js";

describe("withoutRoot", () => {
    it.for([
        { path: "color.accent.$root", expected: "color.accent" },
        { path: "color.brand", expected: "color.brand" },
        { path: "$root", expected: "$root" },
    ])("$path is $expected", ({ path, expected }) => {
        expect(withoutRoot(path)).toBe(expected);
    });
});

describe("pathBelow", () => {
    it.for([
        { path: "color.brand.ink", group: "color", expected: "brand.ink" },
        { path: "color.brand.ink", group: "color.brand", expected: "ink" },
        { path: "color.$root", group: "color", expected: "$root" },
        { path: "color.ink", group: "", expected: "color.ink" },
        { path: "color", group: "color", expected: undefined },
        { path: "colors.ink", group: "color", expected: undefined },
        { path: "color", group: "color.brand", expected: undefined },
    ])("$path below $group is $expected", ({ path, group, expected }) => {
        expect(pathBelow(path, group)).toBe(expected);
    });
});
