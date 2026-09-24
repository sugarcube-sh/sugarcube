import { SUGARCUBE_NAMESPACE, type TokenTree } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { createMeasureLookup, declaredMeasure, measuresBySlot } from "../src/tokens/measures";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

function tree(tokens: unknown): TokenTree {
    return { tokens, sourcePath: "tokens.json" } as unknown as TokenTree;
}

const measures = (value: string) => ({
    $extensions: { [SUGARCUBE_NAMESPACE]: { measures: value } },
});

describe("declaredMeasure", () => {
    it("reads it off the group a token sits in", () => {
        const trees = [
            tree({
                radius: {
                    ...measures("border-radius"),
                    sm: { $value: { value: 0.25, unit: "rem" } },
                },
            }),
        ];

        expect(declaredMeasure(trees, "radius.sm")).toBe("border-radius");
    });

    it("lets a token override its group", () => {
        const trees = [
            tree({
                space: {
                    ...measures("gap"),
                    inset: { ...measures("padding"), $value: { value: 1, unit: "rem" } },
                    md: { $value: { value: 1, unit: "rem" } },
                },
            }),
        ];

        expect(declaredMeasure(trees, "space.inset")).toBe("padding");
        expect(declaredMeasure(trees, "space.md")).toBe("gap");
    });

    it("inherits from any ancestor, not just the immediate parent", () => {
        const trees = [
            tree({
                border: {
                    ...measures("border-width"),
                    width: { thin: { $value: { value: 1, unit: "px" } } },
                },
            }),
        ];

        expect(declaredMeasure(trees, "border.width.thin")).toBe("border-width");
    });

    it("is undefined where nobody has said", () => {
        const trees = [tree({ space: { md: { $value: { value: 1, unit: "rem" } } } })];

        expect(declaredMeasure(trees, "space.md")).toBeUndefined();
    });
});

describe("measuresBySlot", () => {
    function lookup(...fixtures: Parameters<typeof resolved>) {
        const map = resolved(...fixtures);
        return measuresBySlot(map, new PathIndex(map));
    }

    it("types a dimension referenced from a typography slot", () => {
        const found = lookup(
            { path: "text.sm", value: { value: 0.875, unit: "rem" } },
            {
                path: "type.body",
                type: "typography",
                value: { fontFamily: "Inter", fontSize: "{text.sm}", lineHeight: 1.5 },
            },
        );

        expect(found.get("text.sm")).toBe("font-size");
    });

    it("types one referenced from a border slot", () => {
        const found = lookup(
            { path: "line.thin", value: { value: 1, unit: "px" } },
            {
                path: "border.default",
                type: "border",
                value: { color: "#000", width: "{line.thin}", style: "solid" },
            },
        );

        expect(found.get("line.thin")).toBe("border-width");
    });

    it("leaves out a token whose slots disagree", () => {
        const found = lookup(
            { path: "size.1", value: { value: 1, unit: "px" } },
            {
                path: "type.body",
                type: "typography",
                value: { fontFamily: "Inter", letterSpacing: "{size.1}", lineHeight: 1.5 },
            },
            {
                path: "border.default",
                type: "border",
                value: { color: "#000", width: "{size.1}", style: "solid" },
            },
        );

        expect(found.has("size.1")).toBe(false);
    });

    it("ignores an inlined value, which references no token", () => {
        const found = lookup({
            path: "type.body",
            type: "typography",
            value: { fontFamily: "Inter", fontSize: { value: 1, unit: "rem" }, lineHeight: 1.5 },
        });

        expect(found.size).toBe(0);
    });
});

describe("createMeasureLookup", () => {
    it("prefers what was declared over how it happens to be used", () => {
        const map = resolved(
            { path: "text.sm", value: { value: 0.875, unit: "rem" } },
            {
                path: "shadow.card",
                type: "border",
                value: { color: "#000", width: "{text.sm}", style: "solid" },
            },
        );
        const trees = [tree({ text: { ...measures("font-size") } })];

        const measure = createMeasureLookup(trees, map, new PathIndex(map));

        expect(measure("text.sm")).toBe("font-size");
    });

    it("falls back to usage where nothing was declared", () => {
        const map = resolved(
            { path: "text.sm", value: { value: 0.875, unit: "rem" } },
            {
                path: "type.body",
                type: "typography",
                value: { fontFamily: "Inter", fontSize: "{text.sm}", lineHeight: 1.5 },
            },
        );

        expect(createMeasureLookup([], map, new PathIndex(map))("text.sm")).toBe("font-size");
    });

    it("flows a declaration on the primitive down to what references it", () => {
        const map = resolved(
            { path: "size.step.0", value: { value: 1.125, unit: "rem" } },
            { path: "typography.text.base", value: "{size.step.0}" },
            { path: "heading.1", value: "{typography.text.base}" },
        );
        const trees = [tree({ size: { step: measures("font-size") } })];

        const measure = createMeasureLookup(trees, map, new PathIndex(map));

        expect(measure("size.step.0")).toBe("font-size");
        expect(measure("typography.text.base")).toBe("font-size");
        expect(measure("heading.1")).toBe("font-size");
    });

    it("lets a declaration nearer the token override the one it inherits", () => {
        const map = resolved(
            { path: "size.step.0", value: { value: 1.125, unit: "rem" } },
            { path: "typography.text.base", value: "{size.step.0}" },
        );
        const trees = [
            tree({
                size: { step: measures("inline-size") },
                typography: { text: measures("font-size") },
            }),
        ];

        const measure = createMeasureLookup(trees, map, new PathIndex(map));

        expect(measure("size.step.0")).toBe("inline-size");
        expect(measure("typography.text.base")).toBe("font-size");
    });

    it("says nothing about a primitive when the declaration is above it", () => {
        const map = resolved(
            { path: "size.step.0", value: { value: 1.125, unit: "rem" } },
            { path: "typography.text.base", value: "{size.step.0}" },
        );
        const trees = [tree({ typography: { text: measures("font-size") } })];

        const measure = createMeasureLookup(trees, map, new PathIndex(map));

        expect(measure("typography.text.base")).toBe("font-size");
        expect(measure("size.step.0")).toBeUndefined();
    });

    it("lets one primitive serve two purposes, each declared on its own branch", () => {
        const map = resolved(
            { path: "size.step.0", value: { value: 1.125, unit: "rem" } },
            { path: "typography.text.base", value: "{size.step.0}" },
            { path: "layout.narrow", value: "{size.step.0}" },
        );
        const trees = [
            tree({
                typography: { text: measures("font-size") },
                layout: measures("inline-size"),
            }),
        ];

        const measure = createMeasureLookup(trees, map, new PathIndex(map));

        expect(measure("typography.text.base")).toBe("font-size");
        expect(measure("layout.narrow")).toBe("inline-size");
        expect(measure("size.step.0")).toBeUndefined();
    });

    it("is undefined when neither says, which is the bar", () => {
        const map = resolved({ path: "space.md", value: { value: 1, unit: "rem" } });

        expect(createMeasureLookup([], map, new PathIndex(map))("space.md")).toBeUndefined();
    });
});
