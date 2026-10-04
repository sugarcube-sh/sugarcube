import { describe, expect, it } from "vitest";
import { withoutRoot } from "../src/index.js";

describe("withoutRoot", () => {
    it.for([
        { path: "color.accent.$root", expected: "color.accent" },
        { path: "color.brand", expected: "color.brand" },
        { path: "$root", expected: "$root" },
    ])("$path is $expected", ({ path, expected }) => {
        expect(withoutRoot(path)).toBe(expected);
    });
});
