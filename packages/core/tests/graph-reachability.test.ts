import { describe, expect, it } from "vitest";
import { buildTokenGraph } from "../src/shared/graph/build-token-graph.js";
import {
    dependentsOf,
    dependentsVia,
    directDependents,
    findUnusedTokens,
    reachableFrom,
} from "../src/shared/graph/reachability.js";
import type { NormalizedRenderableTokens, RenderableToken } from "../src/types/render.js";

function tok(path: string, value: unknown, css: string, type = "color"): RenderableToken {
    return {
        $type: type,
        $path: path,
        $value: value,
        $names: { css },
        $source: { sourcePath: "test" },
        $originalPath: path,
    } as RenderableToken;
}

describe("reachability", () => {
    const tokens: NormalizedRenderableTokens = {
        default: {
            "button.bg": tok("button.bg", "{color.accent}", "button-bg"),
            "color.accent": tok("color.accent", "{color.pink.600}", "color-accent"),
            "color.pink.600": tok("color.pink.600", "#ec4899", "color-pink-600"),
            "color.brand.legacy": tok("color.brand.legacy", "#abcdef", "color-brand-legacy"),
        },
    };

    it("follows alias edges transitively from the roots", () => {
        const graph = buildTokenGraph(tokens);
        const reached = reachableFrom(graph, ["button.bg"]);
        expect([...reached].sort()).toEqual(["button.bg", "color.accent", "color.pink.600"]);
    });

    it("reports tokens no root reaches as unused", () => {
        const graph = buildTokenGraph(tokens);
        expect(findUnusedTokens(graph, ["button.bg"])).toEqual(["color.brand.legacy"]);
    });

    it("keeps a primitive consumed only through an alias (no false 'unused')", () => {
        const graph = buildTokenGraph(tokens);
        expect(findUnusedTokens(graph, ["button.bg"])).not.toContain("color.pink.600");
    });

    it("treats reachable-in-any-context as reached (union across modes)", () => {
        const graph = buildTokenGraph({
            default: {
                "color.surface": tok("color.surface", "{color.neutral.50}", "color-surface"),
                "color.neutral.50": tok("color.neutral.50", "#fafafa", "color-neutral-50"),
                "color.neutral.900": tok("color.neutral.900", "#171717", "color-neutral-900"),
            },
            dark: {
                "color.surface": tok("color.surface", "{color.neutral.900}", "color-surface"),
                "color.neutral.50": tok("color.neutral.50", "#fafafa", "color-neutral-50"),
                "color.neutral.900": tok("color.neutral.900", "#171717", "color-neutral-900"),
            },
        });
        expect(findUnusedTokens(graph, ["color.surface"])).toEqual([]);
    });

    it("ignores roots that aren't tokens in the graph", () => {
        const graph = buildTokenGraph(tokens);
        const reached = reachableFrom(graph, ["button.bg", "--sl-color-text"]);
        expect(reached.has("button.bg")).toBe(true);
        expect(reached.has("--sl-color-text")).toBe(false);
    });

    it("reports every token unused when there are no roots", () => {
        const graph = buildTokenGraph(tokens);
        expect(findUnusedTokens(graph, [])).toEqual([
            "button.bg",
            "color.accent",
            "color.brand.legacy",
            "color.pink.600",
        ]);
    });
});

describe("dependents", () => {
    const tokens: NormalizedRenderableTokens = {
        default: {
            "button.bg": tok("button.bg", "{color.accent}", "button-bg"),
            "color.accent": tok("color.accent", "{color.pink.600}", "color-accent"),
            "color.error.fill": tok("color.error.fill", "{color.pink.600}", "color-error-fill"),
            "color.pink.600": tok("color.pink.600", "#ec4899", "color-pink-600"),
        },
    };

    it("returns the one-hop fan-in as directDependents", () => {
        const graph = buildTokenGraph(tokens);
        expect(directDependents(graph, "color.pink.600")).toEqual([
            "color.accent",
            "color.error.fill",
        ]);
    });

    it("returns the full transitive blast radius via dependentsOf", () => {
        const graph = buildTokenGraph(tokens);
        expect([...dependentsOf(graph, ["color.pink.600"])].sort()).toEqual([
            "button.bg",
            "color.accent",
            "color.error.fill",
        ]);
    });

    it("excludes the target itself from its dependents", () => {
        const graph = buildTokenGraph(tokens);
        expect(dependentsOf(graph, ["color.pink.600"]).has("color.pink.600")).toBe(false);
    });

    it("returns nothing for a token nothing aliases", () => {
        const graph = buildTokenGraph(tokens);
        expect(directDependents(graph, "button.bg")).toEqual([]);
        expect([...dependentsOf(graph, ["button.bg"])]).toEqual([]);
    });

    it("maps each dependent to the hop one step closer to the target", () => {
        const graph = buildTokenGraph(tokens);
        const via = dependentsVia(graph, "color.pink.600");
        expect(via.get("color.accent")).toBe("color.pink.600");
        expect(via.get("color.error.fill")).toBe("color.pink.600");
        expect(via.get("button.bg")).toBe("color.accent");
        expect([...via.keys()].sort()).toEqual([...dependentsOf(graph, ["color.pink.600"])].sort());
        expect(via.has("color.pink.600")).toBe(false);
    });

    it("unions dependents across mode-conditional edges", () => {
        const graph = buildTokenGraph({
            default: { "color.surface": tok("color.surface", "#fff", "color-surface") },
            dark: { "color.surface": tok("color.surface", "{color.pink.600}", "color-surface") },
        });
        expect(directDependents(graph, "color.pink.600")).toEqual(["color.surface"]);
    });
});
