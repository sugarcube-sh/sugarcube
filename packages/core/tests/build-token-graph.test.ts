import { describe, expect, it } from "vitest";
import { buildTokenGraph } from "../src/shared/graph/build-token-graph.js";
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

describe("buildTokenGraph", () => {
    const tokens: NormalizedRenderableTokens = {
        default: {
            "color.fill.normal": tok(
                "color.fill.normal",
                "{color.neutral.100}",
                "color-fill-normal",
            ),
            "color.neutral.100": tok("color.neutral.100", "#f5f5f5", "color-neutral-100"),
        },
        dark: {
            "color.fill.normal": tok(
                "color.fill.normal",
                "{color.neutral.100}",
                "color-fill-normal",
            ),
            "color.neutral.100": tok("color.neutral.100", "#0a0a0a", "color-neutral-100"),
        },
    };

    it("creates one node per token path with name, group and cssName", () => {
        const graph = buildTokenGraph(tokens);
        expect(graph.contexts.map((context) => context.id)).toEqual(["default", "dark"]);
        expect([...graph.nodes.keys()].sort()).toEqual(["color.fill.normal", "color.neutral.100"]);
        const fill = graph.nodes.get("color.fill.normal");
        expect(fill?.name).toBe("normal");
        expect(fill?.group).toBe("color.fill");
        expect(fill?.cssName).toBe("color-fill-normal");
    });

    it("classifies alias vs primitive", () => {
        const graph = buildTokenGraph(tokens);
        expect(graph.nodes.get("color.fill.normal")?.perContext.default?.kind).toBe("alias");
        expect(graph.nodes.get("color.neutral.100")?.perContext.default?.kind).toBe("primitive");
    });

    it("captures per-context raw values", () => {
        const graph = buildTokenGraph(tokens);
        const primitive = graph.nodes.get("color.neutral.100");
        expect(primitive?.perContext.default?.raw).toBe("#f5f5f5");
        expect(primitive?.perContext.dark?.raw).toBe("#0a0a0a");
    });

    it("creates an alias edge tagged with every context it appears in", () => {
        const graph = buildTokenGraph(tokens);
        expect(graph.edges).toEqual([
            { from: "color.fill.normal", to: "color.neutral.100", contexts: ["default", "dark"] },
        ]);
    });

    it("extracts multiple refs from a composite (typography) value", () => {
        const graph = buildTokenGraph({
            default: {
                "text.body": tok(
                    "text.body",
                    { fontFamily: "{font.sans}", fontSize: "{size.md}" },
                    "text-body",
                    "typography",
                ),
                "font.sans": tok("font.sans", "Inter", "font-sans"),
                "size.md": tok("size.md", "1rem", "size-md"),
            },
        });
        const targets = graph.edges
            .filter((edge) => edge.from === "text.body")
            .map((edge) => edge.to)
            .sort();
        expect(targets).toEqual(["font.sans", "size.md"]);
    });

    it("tags a mode-conditional alias edge with only the context it exists in", () => {
        // surface aliases neutral.50 in light, neutral.900 in dark
        const graph = buildTokenGraph({
            default: {
                "color.surface": tok("color.surface", "{color.neutral.50}", "color-surface"),
            },
            dark: { "color.surface": tok("color.surface", "{color.neutral.900}", "color-surface") },
        });
        const edges = [...graph.edges].sort((a, b) => a.to.localeCompare(b.to));
        expect(edges).toEqual([
            { from: "color.surface", to: "color.neutral.50", contexts: ["default"] },
            { from: "color.surface", to: "color.neutral.900", contexts: ["dark"] },
        ]);
    });

    it("drops a trailing .$root from the display name", () => {
        const graph = buildTokenGraph({
            default: { "color.accent.$root": tok("color.accent.$root", "#ff0000", "color-accent") },
        });
        const node = graph.nodes.get("color.accent.$root");
        expect(node?.name).toBe("accent");
        expect(node?.group).toBe("color");
    });

    it("labels perm:N contexts from their permutation", () => {
        const graph = buildTokenGraph(
            {
                "perm:0": { "color.x": tok("color.x", "#fff", "color-x") },
                "perm:1": { "color.x": tok("color.x", "#000", "color-x") },
            },
            {
                permutations: [
                    { input: { mode: "light" }, selector: ":root" },
                    { input: { mode: "dark" }, selector: '[data-mode="dark"]' },
                ],
            },
        );
        expect(graph.contexts).toEqual([
            { id: "perm:0", label: "mode: light", selector: ":root", input: { mode: "light" } },
            {
                id: "perm:1",
                label: "mode: dark",
                selector: '[data-mode="dark"]',
                input: { mode: "dark" },
            },
        ]);
    });

    it("indexes permutations by the parsed perm number, not array position (handles gaps)", () => {
        // perm:2 resolved to no tokens and was skipped, so the surviving keys are perm:0 and perm:3
        const graph = buildTokenGraph(
            {
                "perm:0": { "color.x": tok("color.x", "#fff", "color-x") },
                "perm:3": { "color.x": tok("color.x", "#000", "color-x") },
            },
            {
                permutations: [
                    { input: { mode: "light" }, selector: ":root" },
                    { input: { mode: "dark" }, selector: "a" },
                    { input: { mode: "dim" }, selector: "b" },
                    { input: { mode: "black" }, selector: "c" },
                ],
            },
        );
        // perm:3 must resolve to permutations[3] ("black"), not permutations[1]
        expect(graph.contexts.map((context) => context.label)).toEqual([
            "mode: light",
            "mode: black",
        ]);
    });

    it("falls back to the context key when no permutations are passed", () => {
        const graph = buildTokenGraph({
            "perm:0": { "color.x": tok("color.x", "#fff", "color-x") },
        });
        expect(graph.contexts).toEqual([{ id: "perm:0", label: "perm:0" }]);
    });

    it("labels an empty-input (no-modifier) permutation as 'default'", () => {
        const graph = buildTokenGraph(
            { "perm:0": { "color.x": tok("color.x", "#fff", "color-x") } },
            { permutations: [{ input: {}, selector: ":root" }] },
        );
        expect(graph.contexts[0]?.label).toBe("default");
    });

    it("labels multiple modifiers as name: value pairs", () => {
        const graph = buildTokenGraph(
            { "perm:0": { "color.x": tok("color.x", "#fff", "color-x") } },
            { permutations: [{ input: { theme: "dark", brand: "ocean" }, selector: ":root" }] },
        );
        expect(graph.contexts[0]?.label).toBe("theme: dark · brand: ocean");
    });
});
