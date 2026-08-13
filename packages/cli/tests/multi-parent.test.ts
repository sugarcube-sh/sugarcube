import { buildTokenGraph } from "@sugarcube-sh/core";
import type { NormalizedRenderableTokens, Permutation, RenderableToken } from "@sugarcube-sh/core";
import { describe, expect, it } from "vitest";
import {
    chooseParents,
    defaultContextParents,
    describeElidedParents,
} from "../src/analyze/multi-parent.js";

function tok(path: string, value: unknown, css: string): RenderableToken {
    return {
        $type: "color",
        $path: path,
        $value: value,
        $names: { css },
        $source: { sourcePath: "test" },
        $originalPath: path,
    } as RenderableToken;
}

const VARIANTS = ["accent", "danger", "info"];

const permutations = VARIANTS.map(
    (variant) =>
        ({ input: { variant }, selector: `[data-variant="${variant}"]` }) as unknown as Permutation,
);

const perVariantTokens: NormalizedRenderableTokens = Object.fromEntries(
    VARIANTS.map((variant, index) => [
        `perm:${index}`,
        {
            "v.on-strong": tok("v.on-strong", `{color.${variant}.on-strong}`, "v-on-strong"),
            [`color.${variant}.on-strong`]: tok(
                `color.${variant}.on-strong`,
                "{color.base.white}",
                `color-${variant}-on-strong`,
            ),
            "color.base.white": tok("color.base.white", "#ffffff", "color-base-white"),
        },
    ]),
);

describe("chooseParents", () => {
    it("keeps the only parent when there is one", () => {
        const parents = new Map([["child", ["parent"]]]);
        expect(chooseParents(parents, () => 0).get("child")).toBe("parent");
    });

    it("prefers the parent the default context points at, over the most-used one", () => {
        const parents = new Map([["child", ["defaulted", "busy"]]]);
        const uses = (id: string) => (id === "busy" ? 11 : 0);
        const preferred = new Map([["child", "defaulted"]]);

        expect(chooseParents(parents, uses, preferred).get("child")).toBe("defaulted");
    });

    it("falls back to the most-used parent when no context is the default", () => {
        const parents = new Map([["child", ["quiet", "busy"]]]);
        const uses = (id: string) => (id === "busy" ? 11 : 0);

        expect(chooseParents(parents, uses).get("child")).toBe("busy");
    });

    it("breaks ties alphabetically, so runs are reproducible", () => {
        const parents = new Map([["child", ["zeta", "alpha"]]]);
        expect(chooseParents(parents, () => 0).get("child")).toBe("alpha");
    });
});

describe("defaultContextParents", () => {
    it("names the parent reached in the context that selects no modifiers", () => {
        const withDefault = [
            { input: {}, selector: ":root" },
            { input: { variant: "danger" }, selector: '[data-variant="danger"]' },
        ] as unknown as Permutation[];
        const tokens: NormalizedRenderableTokens = {
            "perm:0": {
                "v.on-strong": tok("v.on-strong", "{color.accent.on-strong}", "v-on-strong"),
            },
            "perm:1": {
                "v.on-strong": tok("v.on-strong", "{color.danger.on-strong}", "v-on-strong"),
            },
        };
        const graph = buildTokenGraph(tokens, { permutations: withDefault });
        const parents = new Map([
            ["v.on-strong", ["color.accent.on-strong", "color.danger.on-strong"]],
        ]);

        expect(defaultContextParents(graph, parents).get("v.on-strong")).toBe(
            "color.accent.on-strong",
        );
    });

    it("says nothing when no context is the default", () => {
        const graph = buildTokenGraph(perVariantTokens, { permutations });
        const parents = new Map([
            ["v.on-strong", VARIANTS.map((variant) => `color.${variant}.on-strong`)],
        ]);

        expect(defaultContextParents(graph, parents).size).toBe(0);
    });

    it("says nothing when several contexts could be the default", () => {
        const tokens: NormalizedRenderableTokens = {
            default: {
                "color.surface": tok("color.surface", "{color.neutral.50}", "color-surface"),
            },
            dark: { "color.surface": tok("color.surface", "{color.neutral.900}", "color-surface") },
        };
        const graph = buildTokenGraph(tokens);
        const parents = new Map([["color.surface", ["color.neutral.50", "color.neutral.900"]]]);

        expect(defaultContextParents(graph, parents).size).toBe(0);
    });
});

describe("describeElidedParents", () => {
    it("names the modifier that distinguishes the parents", () => {
        const graph = buildTokenGraph(perVariantTokens, { permutations });
        const parents = new Map([
            ["v.on-strong", VARIANTS.map((variant) => `color.${variant}.on-strong`)],
        ]);

        expect(describeElidedParents(graph, parents).get("v.on-strong")).toBe("per variant");
    });

    it("names whichever modifier the project declared, not a built-in one", () => {
        const byDensity = [
            { input: { density: "comfortable" } },
            { input: { density: "compact" } },
        ] as unknown as Permutation[];
        const tokens: NormalizedRenderableTokens = {
            "perm:0": { "space.gap": tok("space.gap", "{space.md}", "space-gap") },
            "perm:1": { "space.gap": tok("space.gap", "{space.sm}", "space-gap") },
        };
        const graph = buildTokenGraph(tokens, { permutations: byDensity });
        const parents = new Map([["space.gap", ["space.md", "space.sm"]]]);

        expect(describeElidedParents(graph, parents).get("space.gap")).toBe("per density");
    });

    // Resolver spec §2.1: modifiers may be non-orthogonal
    it("finds the deciding modifier when two modifiers claim the same token", () => {
        const matrix = [
            { input: { theme: "light", brand: "a" } },
            { input: { theme: "light", brand: "b" } },
            { input: { theme: "dark", brand: "a" } },
            { input: { theme: "dark", brand: "b" } },
        ] as unknown as Permutation[];
        const wins = ["blue", "red", "blue", "red"];
        const tokens: NormalizedRenderableTokens = Object.fromEntries(
            wins.map((colour, index) => [
                `perm:${index}`,
                { "color.button": tok("color.button", `{color.${colour}}`, "color-button") },
            ]),
        );
        const graph = buildTokenGraph(tokens, { permutations: matrix });
        const parents = new Map([["color.button", ["color.blue", "color.red"]]]);

        expect(describeElidedParents(graph, parents).get("color.button")).toBe("per brand");
    });

    // Spec Example 7: a modifier whose contexts contribute no tokens at all (a debug flag).
    it("ignores a modifier whose contexts contribute nothing", () => {
        const matrix = [
            { input: { variant: "accent", debug: "false" } },
            { input: { variant: "accent", debug: "true" } },
            { input: { variant: "danger", debug: "false" } },
            { input: { variant: "danger", debug: "true" } },
        ] as unknown as Permutation[];
        const tokens: NormalizedRenderableTokens = Object.fromEntries(
            ["accent", "accent", "danger", "danger"].map((variant, index) => [
                `perm:${index}`,
                {
                    "v.on-strong": tok(
                        "v.on-strong",
                        `{color.${variant}.on-strong}`,
                        "v-on-strong",
                    ),
                },
            ]),
        );
        const graph = buildTokenGraph(tokens, { permutations: matrix });
        const parents = new Map([
            ["v.on-strong", ["color.accent.on-strong", "color.danger.on-strong"]],
        ]);

        expect(describeElidedParents(graph, parents).get("v.on-strong")).toBe("per variant");
    });

    it("says nothing about a token with a single parent", () => {
        const graph = buildTokenGraph(perVariantTokens, { permutations });
        const parents = new Map([["color.accent.on-strong", ["color.base.white"]]]);

        expect(describeElidedParents(graph, parents).has("color.accent.on-strong")).toBe(false);
    });

    it("names the modifier that partitions the parents, not one that merely varies", () => {
        const matrix = [
            { input: { variant: "accent", theme: "light" } },
            { input: { variant: "accent", theme: "dark" } },
            { input: { variant: "danger", theme: "light" } },
            { input: { variant: "danger", theme: "dark" } },
        ] as unknown as Permutation[];
        const tokens: NormalizedRenderableTokens = Object.fromEntries(
            ["accent", "accent", "danger", "danger"].map((variant, index) => [
                `perm:${index}`,
                {
                    "v.on-strong": tok(
                        "v.on-strong",
                        `{color.${variant}.on-strong}`,
                        "v-on-strong",
                    ),
                },
            ]),
        );
        const graph = buildTokenGraph(tokens, { permutations: matrix });
        const parents = new Map([
            ["v.on-strong", ["color.accent.on-strong", "color.danger.on-strong"]],
        ]);

        expect(describeElidedParents(graph, parents).get("v.on-strong")).toBe("per variant");
    });

    it("falls back to 'per context' when more than one modifier differs", () => {
        const mixed = [
            { input: { variant: "accent", theme: "light" } },
            { input: { variant: "danger", theme: "dark" } },
        ] as unknown as Permutation[];
        const tokens: NormalizedRenderableTokens = {
            "perm:0": {
                "v.on-strong": tok("v.on-strong", "{color.accent.on-strong}", "v-on-strong"),
            },
            "perm:1": {
                "v.on-strong": tok("v.on-strong", "{color.danger.on-strong}", "v-on-strong"),
            },
        };
        const graph = buildTokenGraph(tokens, { permutations: mixed });
        const parents = new Map([
            ["v.on-strong", ["color.accent.on-strong", "color.danger.on-strong"]],
        ]);

        expect(describeElidedParents(graph, parents).get("v.on-strong")).toBe("per context");
    });

    it("says how many references when the parents don't vary by context", () => {
        const tokens: NormalizedRenderableTokens = {
            default: {
                "shadow.md": tok("shadow.md", "0 0 {space.sm} {color.shadow}", "shadow-md"),
            },
        };
        const graph = buildTokenGraph(tokens);
        const parents = new Map([["shadow.md", ["space.sm", "color.shadow"]]]);

        expect(describeElidedParents(graph, parents).get("shadow.md")).toBe("2 references");
    });

    it("falls back to 'per context' when the contexts carry no modifier input", () => {
        const tokens: NormalizedRenderableTokens = {
            default: { "v.on-strong": tok("v.on-strong", "{color.a}", "v-on-strong") },
            dark: { "v.on-strong": tok("v.on-strong", "{color.b}", "v-on-strong") },
        };
        const graph = buildTokenGraph(tokens);
        const parents = new Map([["v.on-strong", ["color.a", "color.b"]]]);

        expect(describeElidedParents(graph, parents).get("v.on-strong")).toBe("per context");
    });
});
