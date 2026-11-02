import { describe, expect, it } from "vitest";
import { tokenPath } from "../src/index.js";

describe("tokenPath.removeRoot", () => {
    it.for([
        { path: "color.accent.$root", expected: "color.accent" },
        { path: "color.brand", expected: "color.brand" },
        { path: "$root", expected: "$root" },
    ])("$path is $expected", ({ path, expected }) => {
        expect(tokenPath.removeRoot(path)).toBe(expected);
    });
});

describe("tokenPath.relative", () => {
    it.for([
        { path: "color.brand.ink", group: "color", expected: "brand.ink" },
        { path: "color.brand.ink", group: "color.brand", expected: "ink" },
        { path: "color.$root", group: "color", expected: "$root" },
        { path: "color.ink", group: "", expected: undefined },
        { path: ".x", group: "", expected: "x" },
        { path: "color", group: "color", expected: undefined },
        { path: "colors.ink", group: "color", expected: undefined },
        { path: "color", group: "color.brand", expected: undefined },
    ])("$path relative to $group is $expected", ({ path, group, expected }) => {
        expect(tokenPath.relative(group, path)).toBe(expected);
    });
});

describe("tokenPath.contains", () => {
    it.for([
        { path: "color.brand", group: "color.brand", expected: true },
        { path: "color.brand.500", group: "color.brand", expected: true },
        { path: "color.brand.500", group: "color", expected: true },
        { path: ".x", group: "", expected: true },
        { path: "color.brandy", group: "color.brand", expected: false },
        { path: "color", group: "color.brand", expected: false },
        { path: "color.ink", group: "", expected: false },
    ])("$group contains $path: $expected", ({ path, group, expected }) => {
        expect(tokenPath.contains(group, path)).toBe(expected);
    });
});

describe("tokenPath.parent", () => {
    it.for([
        { path: "color.brand.500", expected: "color.brand" },
        { path: "color.brand.$root", expected: "color.brand" },
        { path: "color", expected: undefined },
        { path: "", expected: undefined },
        { path: ".x", expected: "" },
    ])("$path is inside $expected", ({ path, expected }) => {
        expect(tokenPath.getParent(path)).toBe(expected);
    });
});

describe("tokenPath.join", () => {
    it.for([
        { parent: "color.brand", name: "500", expected: "color.brand.500" },
        { parent: "color", name: "$root", expected: "color.$root" },
        { parent: undefined, name: "color", expected: "color" },
        { parent: undefined, name: "", expected: "" },
        { parent: "", name: "x", expected: ".x" },
    ])("$name inside $parent is $expected", ({ parent, name, expected }) => {
        expect(tokenPath.join(parent, name)).toBe(expected);
    });

    it("is undone by tokenPath.parent", () => {
        for (const path of ["color.brand.500", "color", ".x", ""]) {
            const parent = tokenPath.getParent(path);
            const name = parent === undefined ? path : path.slice(parent.length + 1);
            expect(tokenPath.join(parent, name)).toBe(path);
        }
    });
});

describe("tokenPath.findInvalidCharacter", () => {
    it.for([
        { name: "a.b", expected: "." },
        { name: "{x", expected: "{" },
        { name: "x}", expected: "}" },
        { name: "$x", expected: "$" },
        { name: "a$b", expected: undefined },
        { name: "$root", expected: undefined },
        { name: "brand", expected: undefined },
    ])("$name gives $expected (Format 5.1.1)", ({ name, expected }) => {
        expect(tokenPath.findInvalidCharacter(name)).toBe(expected);
    });
});

describe("tokenPath.applyMoves", () => {
    const moved = [
        { from: "color.brand", to: "color.house" },
        { from: "color.house.500", to: "color.house.550" },
    ];
    it.for([
        { path: "color.brand", expected: "color.house" },
        { path: "color.brand.300", expected: "color.house.300" },
        { path: "color.brand.500", expected: "color.house.550" },
        { path: "color.brand.$root", expected: "color.house.$root" },
        { path: "color.branding", expected: "color.branding" },
        { path: "space.sm", expected: "space.sm" },
    ])("$path ends up at $expected", ({ path, expected }) => {
        expect(tokenPath.applyMoves(path, moved)).toBe(expected);
    });

    it('carries what is inside the group named "", and nothing at the top level', () => {
        const renamed = [{ from: "", to: "named" }];
        expect(tokenPath.applyMoves(".x", renamed)).toBe("named.x");
        expect(tokenPath.applyMoves("color", renamed)).toBe("color");
    });
});
