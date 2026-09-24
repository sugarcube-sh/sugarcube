import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { documentRamps } from "../src/tokens/palettes";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

function ctxFor(map: ResolvedTokens) {
    return { pathIndex: new PathIndex(map), resolved: map, context: "default" };
}

function names(map: ResolvedTokens): string[] {
    return documentRamps(ctxFor(map))
        .map((ramp) => ramp.name)
        .sort();
}

const DEMO = resolved(
    { path: "color.brand.50", type: "color", value: "#f1f5fd" },
    { path: "color.brand.500", type: "color", value: "#4d7bd9" },
    { path: "color.neutral.50", type: "color", value: "#fafafb" },
    { path: "color.neutral.600", type: "color", value: "#616170" },
    { path: "color.text.default", type: "color", value: "{color.neutral.600}" },
    { path: "color.text.brand", type: "color", value: "{color.brand.500}" },
    { path: "color.surface.default", type: "color", value: "{color.neutral.50}" },
);

describe("documentRamps", () => {
    it("offers the colours the document holds, not the decisions made with them", () => {
        expect(names(DEMO)).toEqual(["color.brand", "color.neutral"]);
    });

    it("cannot offer a token itself, because a token that points is never in the list", () => {
        const paths = documentRamps(ctxFor(DEMO)).flatMap((r) => r.steps.map((s) => s.value));

        expect(paths).not.toContain("color.surface.default");
    });

    it("keeps a colour that is not part of a ramp", () => {
        const map = resolved(
            { path: "color.white", type: "color", value: "#ffffff" },
            { path: "color.surface.default", type: "color", value: "{color.white}" },
        );

        expect(names(map)).toEqual(["color"]);
    });

    it("keeps the literal colours in a group that also holds references", () => {
        const map = resolved(
            { path: "color.bg", type: "color", value: "#FAF9F5" },
            { path: "color.primary", type: "color", value: "#c96442" },
            { path: "color.overlay", type: "color", value: "{color.alpha.black.50}" },
            { path: "color.alpha.black.50", type: "color", value: "#00000080" },
        );

        const steps = documentRamps(ctxFor(map))
            .flatMap((r) => r.steps.map((s) => s.value))
            .sort();

        expect(steps).toEqual(["color.alpha.black.50", "color.bg", "color.primary"]);
    });

    it("ignores tokens that are not colours", () => {
        const map = resolved(
            { path: "color.brand.500", type: "color", value: "#4d7bd9" },
            { path: "space.md", type: "dimension", value: { value: 1, unit: "rem" } },
        );

        expect(names(map)).toEqual(["color.brand"]);
    });
});
