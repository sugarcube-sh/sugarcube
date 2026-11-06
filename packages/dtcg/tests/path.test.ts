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
        { path: "color.ink", group: "", expected: "color.ink" },
        { path: "", group: "", expected: undefined },
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
        { path: "color.ink", group: "", expected: true },
        { path: "", group: "", expected: true },
        { path: "color.brandy", group: "color.brand", expected: false },
        { path: "color", group: "color.brand", expected: false },
    ])("$group contains $path: $expected", ({ path, group, expected }) => {
        expect(tokenPath.contains(group, path)).toBe(expected);
    });
});

describe("tokenPath.getParent", () => {
    it.for([
        { path: "color.brand.500", expected: "color.brand" },
        { path: "color.brand.$root", expected: "color.brand" },
        { path: "color", expected: "" },
        { path: "", expected: undefined },
    ])("$path is inside $expected", ({ path, expected }) => {
        expect(tokenPath.getParent(path)).toBe(expected);
    });
});

describe("tokenPath.getName", () => {
    it.for([
        { path: "color.brand.500", expected: "500" },
        { path: "color.brand.$root", expected: "$root" },
        { path: "color", expected: "color" },
        { path: "", expected: "" },
    ])("$path is named $expected", ({ path, expected }) => {
        expect(tokenPath.getName(path)).toBe(expected);
    });
});

describe("tokenPath.join", () => {
    it.for([
        { parent: "color.brand", name: "500", expected: "color.brand.500" },
        { parent: "color", name: "$root", expected: "color.$root" },
        { parent: "", name: "color", expected: "color" },
    ])("$name inside $parent is $expected", ({ parent, name, expected }) => {
        expect(tokenPath.join(parent, name)).toBe(expected);
    });

    it("is undone by tokenPath.getParent and tokenPath.getName", () => {
        for (const path of ["color.brand.500", "color.brand", "color"]) {
            const parent = tokenPath.getParent(path);
            expect(parent).toBeDefined();
            expect(tokenPath.join(parent ?? "", tokenPath.getName(path))).toBe(path);
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

describe("tokenPath.findNameProblem", () => {
    it.for([
        { name: "brand", expected: undefined },
        { name: "$root", expected: undefined },
        { name: "", expected: {} },
        { name: "a.b", expected: { character: "." } },
        { name: "$x", expected: { character: "$" } },
        { name: "{x}", expected: { character: "{" } },
    ])("$name gives $expected (Format 5.1.1)", ({ name, expected }) => {
        expect(tokenPath.findNameProblem(name)).toStrictEqual(expected);
    });
});

describe("tokenPath.isValidName", () => {
    it.for([
        { name: "brand", expected: true },
        { name: "$root", expected: true },
        { name: "a b", expected: true },
        { name: "", expected: false },
        { name: "a.b", expected: false },
        { name: "$x", expected: false },
    ])("$name gives $expected (Format 5.1.1)", ({ name, expected }) => {
        expect(tokenPath.isValidName(name)).toBe(expected);
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
});
