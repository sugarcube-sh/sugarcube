import { describe, expect, it } from "vitest";
import { cssIdentifier, cssCustomProperty } from "../../src/css.js";

describe("cssIdentifier", () => {
    it.for([
        { path: "color.brand", name: "color-brand" },
        { path: "color.accent.$root", name: "color-accent" },
        { path: "type.body copy.size", name: "type-body-copy-size" },
        { path: "type. body .size", name: "type-body-size" },
        { path: "space.1/2", name: "space-1/2" },
    ])("names $path as $name, unescaped", ({ path, name }) => {
        expect(cssIdentifier(path)).toBe(name);
    });
});

describe("cssCustomProperty", () => {
    it.for([
        { path: "color.brand", name: "--color-brand" },
        { path: "color.accent.$root", name: "--color-accent" },
        { path: "type.body copy.size", name: "--type-body-copy-size" },
    ])("names $path as $name", ({ path, name }) => {
        expect(cssCustomProperty(path)).toBe(name);
    });

    it("puts a prefix first", () => {
        expect(cssCustomProperty("color.brand", { prefix: "ds" })).toBe("--ds-color-brand");
    });

    it("makes the name with a function instead, given the path without $root", () => {
        const seen: string[] = [];
        const name = (path: string) => {
            seen.push(path);
            return path.replaceAll(".", "_");
        };
        expect(cssCustomProperty("color.accent.$root", { prefix: "ds", name })).toBe(
            "--color_accent",
        );
        expect(seen).toStrictEqual(["color.accent"]);
    });

    it("joins every part with the delimiter: the prefix, the path's names and the words in them", () => {
        expect(cssCustomProperty("color.brand", { delimiter: "_" })).toBe("--color_brand");
        expect(cssCustomProperty("color.brand", { prefix: "ds", delimiter: "_" })).toBe(
            "--ds_color_brand",
        );
        expect(cssCustomProperty("type.body copy.size", { delimiter: "_" })).toBe(
            "--type_body_copy_size",
        );
        expect(cssCustomProperty("color.accent.$root", { delimiter: "_" })).toBe("--color_accent");
    });

    it("keeps what a name already holds, joining only the parts it splits", () => {
        expect(cssCustomProperty("color.brand-primary", { delimiter: "_" })).toBe(
            "--color_brand-primary",
        );
    });

    it.for([
        { path: "color.brandPrimary", name: "--color-brand-primary" },
        { path: "Background.Brand.Primary", name: "--background-brand-primary" },
        { path: "state.60Hover", name: "--state-60-hover" },
        { path: "format.XMLParser", name: "--format-xml-parser" },
        { path: "type.Body Copy", name: "--type-body-copy" },
    ])(
        "splits camelCase and PascalCase into lowercase words with case kebab: $path as $name",
        ({ path, name }) => {
            expect(cssCustomProperty(path, { case: "kebab" })).toBe(name);
        },
    );

    it("joins kebab's words with the delimiter, and never changes the prefix's case", () => {
        expect(
            cssCustomProperty("color.brandPrimary", {
                prefix: "DS",
                case: "kebab",
                delimiter: "_",
            }),
        ).toBe("--DS_color_brand_primary");
    });

    it("names one of a typography token's custom properties by its CSS property, joined like any part", () => {
        expect(cssCustomProperty("type.body", { cssProperty: "font-size" })).toBe(
            "--type-body-font-size",
        );
        expect(
            cssCustomProperty("type.bodyCopy", {
                case: "kebab",
                delimiter: "_",
                cssProperty: "font-size",
            }),
        ).toBe("--type_body_copy_font-size");
    });

    it("joins a CSS property to a naming function's name with the delimiter", () => {
        const name = (path: string) => path.replaceAll(".", "_");
        expect(cssCustomProperty("type.body", { name, cssProperty: "font-size" })).toBe(
            "--type_body-font-size",
        );
        expect(
            cssCustomProperty("type.body", { name, delimiter: "_", cssProperty: "font-size" }),
        ).toBe("--type_body_font-size");
    });

    it("escapes a delimiter a CSS name cannot hold", () => {
        expect(cssCustomProperty("color.brand", { delimiter: "/" })).toBe("--color\\/brand");
    });

    it.for([
        { path: "space.1/2", name: "--space-1\\/2" },
        { path: "size.1.5x", name: "--size-1-5x" },
        { path: "ratio.16:9", name: "--ratio-16\\:9" },
        { path: "icon.@2x", name: "--icon-\\@2x" },
        { path: "tone.café", name: "--tone-café" },
        { path: "tone.a+b", name: "--tone-a\\+b" },
    ])("escapes what a CSS name cannot hold: $path as $name", ({ path, name }) => {
        expect(cssCustomProperty(path)).toBe(name);
    });

    it("escapes what a naming function returns too", () => {
        expect(cssCustomProperty("space.half", { name: () => "space/half" })).toBe(
            "--space\\/half",
        );
        expect(cssCustomProperty("x", { name: () => "a\u0001b" })).toBe("--a\\1 b");
        expect(cssCustomProperty("x", { name: () => "a\u0000b" })).toBe("--a\uFFFDb");
    });
});
