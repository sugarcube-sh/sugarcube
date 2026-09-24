import type { ResolvedTokens } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { dependentPaths } from "../src/tokens/dependents";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

/** The demo: a brand ramp, and four roles in three other groups pointing into it. */
const DEMO = resolved(
    { path: "color.brand.50", type: "color", value: "#f1f5fd" },
    { path: "color.brand.500", type: "color", value: "#4d7bd9" },
    { path: "color.brand.600", type: "color", value: "#365ec9" },
    { path: "color.brand.700", type: "color", value: "#2d49a2" },
    { path: "color.neutral.900", type: "color", value: "#233263" },
    { path: "color.text.default", type: "color", value: "{color.neutral.900}" },
    { path: "color.text.brand", type: "color", value: "{color.brand.700}" },
    { path: "color.text.onBrand", type: "color", value: "{color.brand.50}" },
    { path: "color.surface.brand", type: "color", value: "{color.brand.600}" },
    { path: "color.border.brand", type: "color", value: "{color.brand.500}" },
);

function dependents(target: string, map: ResolvedTokens = DEMO, context?: string) {
    const pathIndex = new PathIndex(map);
    const read = (path: string, ctx?: string) => pathIndex.readValue(map, path, ctx);
    return dependentPaths(target, read, pathIndex, context);
}

describe("dependentPaths", () => {
    it("finds everything pointing into a group, from wherever it lives", () => {
        expect(dependents("color.brand").sort()).toEqual([
            "color.border.brand",
            "color.surface.brand",
            "color.text.brand",
            "color.text.onBrand",
        ]);
    });

    it("finds what points at one stop", () => {
        expect(dependents("color.brand.500")).toEqual(["color.border.brand"]);
    });

    it("says nothing for a stop nobody uses", () => {
        expect(dependents("color.brand.600 ")).toEqual([]);
        expect(dependents("color.neutral")).toEqual(["color.text.default"]);
    });

    it("does not count a group's own tokens as pointing into it", () => {
        expect(dependents("color.text")).toEqual([]);
    });

    it("says nothing for a group whose references never leave it", () => {
        // Every role in the demo lives under `color` and points at `color`, so
        // asking what points at `color` is the group pointing at itself.
        expect(dependents("color")).toEqual([]);
    });

    it("still lists a sibling that points at one stop", () => {
        const map = resolved(
            { path: "color.brand.50", type: "color", value: "#f1f5fd" },
            { path: "color.brand.100", type: "color", value: "{color.brand.50}" },
        );

        expect(dependents("color.brand.50", map)).toEqual(["color.brand.100"]);
    });

    it("does not list the token itself", () => {
        const map = resolved(
            { path: "a.one", type: "color", value: "#fff" },
            { path: "a.two", type: "color", value: "{a.one}" },
        );

        expect(dependents("a.one", map)).toEqual(["a.two"]);
    });

    it("counts a dependent once, however many contexts it points from", () => {
        const map = resolved(
            { path: "color.brand.500", type: "color", value: "#4d7bd9", context: "light" },
            { path: "color.brand.500", type: "color", value: "#4d7bd9", context: "dark" },
            {
                path: "color.text.brand",
                type: "color",
                value: "{color.brand.500}",
                context: "light",
            },
            {
                path: "color.text.brand",
                type: "color",
                value: "{color.brand.500}",
                context: "dark",
            },
        );

        expect(dependents("color.brand.500", map, "light")).toEqual(["color.text.brand"]);
    });

    it("ignores a dependent that only points at the target in another context", () => {
        const map = resolved(
            { path: "color.brand.400", type: "color", value: "#749ce7", context: "light" },
            { path: "color.brand.400", type: "color", value: "#749ce7", context: "dark" },
            {
                path: "color.surface.brand",
                type: "color",
                value: "{color.brand.600}",
                context: "light",
            },
            {
                path: "color.surface.brand",
                type: "color",
                value: "{color.brand.400}",
                context: "dark",
            },
        );

        expect(dependents("color.brand.400", map, "light")).toEqual([]);
        expect(dependents("color.brand.400", map, "dark")).toEqual(["color.surface.brand"]);
    });

    it("does not mistake a group whose name merely starts the same", () => {
        const map = resolved(
            { path: "color.brand.500", type: "color", value: "#4d7bd9" },
            { path: "color.branding.logo", type: "color", value: "#000" },
            { path: "role.a", type: "color", value: "{color.branding.logo}" },
        );

        expect(dependents("color.brand", map)).toEqual([]);
    });
});
