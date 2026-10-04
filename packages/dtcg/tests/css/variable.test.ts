import { describe, expect, it } from "vitest";
import { cssVariable } from "../../src/css.js";

describe("cssVariable", () => {
    it.for([
        { path: "color.brand", name: "--color-brand" },
        { path: "color.accent.$root", name: "--color-accent" },
        { path: "type.body copy.size", name: "--type-body-copy-size" },
    ])("names $path as $name", ({ path, name }) => {
        expect(cssVariable(path)).toBe(name);
    });

    it("puts a prefix first", () => {
        expect(cssVariable("color.brand", { prefix: "ds" })).toBe("--ds-color-brand");
    });

    it("makes the name with a function instead, given the path without $root", () => {
        const seen: string[] = [];
        const name = (path: string) => {
            seen.push(path);
            return path.replaceAll(".", "_");
        };
        expect(cssVariable("color.accent.$root", { prefix: "ds", name })).toBe("--color_accent");
        expect(seen).toStrictEqual(["color.accent"]);
    });

    it.for([
        { path: "space.1/2", name: "--space-1\\/2" },
        { path: "size.1.5x", name: "--size-1-5x" },
        { path: "ratio.16:9", name: "--ratio-16\\:9" },
        { path: "icon.@2x", name: "--icon-\\@2x" },
        { path: "tone.café", name: "--tone-café" },
        { path: "tone.a+b", name: "--tone-a\\+b" },
    ])("escapes what a CSS name cannot hold: $path as $name", ({ path, name }) => {
        expect(cssVariable(path)).toBe(name);
    });

    it("escapes what a naming function returns too", () => {
        expect(cssVariable("space.half", { name: () => "space/half" })).toBe("--space\\/half");
        expect(cssVariable("x", { name: () => "a\u0001b" })).toBe("--a\\1 b");
        expect(cssVariable("x", { name: () => "a\u0000b" })).toBe("--a\uFFFDb");
    });
});
