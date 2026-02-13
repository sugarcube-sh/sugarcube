import { describe, expect, it } from "vitest";
import { processTrees } from "../src/pipeline/process-trees.js";
import type { ResolvedToken } from "../src/types/resolve.js";
import type { NodeMetadata, TokenType } from "../src/types/tokens.js";

describe("processTrees", () => {
    it("should handle context/themed tokens correctly", () => {
        const trees = [
            { sourcePath: "tokens.json", tokens: {} },
            { context: "dark", sourcePath: "tokens.json", tokens: {} },
        ];
        const resolved = {
            "color.background": {
                $type: "color",
                $value: "#FFFFFF",
                $source: { sourcePath: "tokens.json" },
            } as ResolvedToken<TokenType>,
            "color.background.dark": {
                $type: "color",
                $value: "#000000",
                $source: { context: "dark", sourcePath: "dark.json" },
            } as ResolvedToken<TokenType>,
        };

        const result = processTrees(trees, resolved);

        const noThemeTree = result.find((t) => !t.context);
        expect((noThemeTree?.tokens["color.background"] as ResolvedToken<TokenType>).$value).toBe(
            "#FFFFFF"
        );
        expect(noThemeTree?.tokens["color.background.dark"]).toBeUndefined();

        const darkTree = result.find((t) => t.context === "dark");
        expect(darkTree?.tokens["color.background"]).toBeUndefined();
        expect((darkTree?.tokens["color.background.dark"] as ResolvedToken<TokenType>).$value).toBe(
            "#000000"
        );
    });

    it("should include metadata nodes in all contexts", () => {
        const trees = [
            { sourcePath: "tokens.json", tokens: {} },
            { context: "dark", sourcePath: "tokens.json", tokens: {} },
        ];
        const resolved = {
            color: {
                $type: "color",
                $description: "Color tokens",
                $path: "color",
            } as NodeMetadata,
        };

        const result = processTrees(trees, resolved);

        for (const tree of result) {
            expect(tree.tokens.color?.$description).toBe("Color tokens");
        }
    });

    it("should handle empty trees", () => {
        const trees = [
            { sourcePath: "tokens.json", tokens: {} },
            { context: "dark", sourcePath: "tokens.json", tokens: {} },
        ];
        const result = processTrees(trees, {});

        expect(result).toEqual([{ tokens: {} }, { context: "dark", tokens: {} }]);
    });

    it("should handle tokens with no matching context", () => {
        const trees = [{ sourcePath: "tokens.json", tokens: {} }];
        const resolved = {
            token1: {
                $type: "color",
                $value: "#FF0000",
                $source: { context: "dark", sourcePath: "dark.json" },
            } as ResolvedToken<TokenType>,
        };

        const result = processTrees(trees, resolved);
        expect(result).toEqual([{ tokens: {} }]);
    });

    it("should handle multiple contexts correctly", () => {
        const trees = [
            { sourcePath: "tokens.json", tokens: {} },
            { context: "dark", sourcePath: "dark.json", tokens: {} },
            { context: "ocean", sourcePath: "ocean.json", tokens: {} },
            { context: "ocean-dark", sourcePath: "ocean-dark.json", tokens: {} },
        ];
        const resolved = {
            "color.primary": {
                $type: "color",
                $value: "#FF0000",
                $source: { sourcePath: "tokens.json" },
            } as ResolvedToken<TokenType>,
            "color.primary.dark": {
                $type: "color",
                $value: "#880000",
                $source: { context: "dark", sourcePath: "dark.json" },
            } as ResolvedToken<TokenType>,
            "color.primary.ocean": {
                $type: "color",
                $value: "#0000FF",
                $source: { context: "ocean", sourcePath: "ocean.json" },
            } as ResolvedToken<TokenType>,
            "color.primary.ocean.dark": {
                $type: "color",
                $value: "#000088",
                $source: { context: "ocean-dark", sourcePath: "ocean-dark.json" },
            } as ResolvedToken<TokenType>,
        };

        const result = processTrees(trees, resolved);

        // Base tree (no theme - default context)
        const baseTree = result.find((t) => !t.context);
        expect((baseTree?.tokens["color.primary"] as ResolvedToken<TokenType>).$value).toBe(
            "#FF0000"
        );

        // Dark context
        const darkTree = result.find((t) => t.context === "dark");
        expect((darkTree?.tokens["color.primary.dark"] as ResolvedToken<TokenType>).$value).toBe(
            "#880000"
        );

        // Ocean context
        const oceanTree = result.find((t) => t.context === "ocean");
        expect((oceanTree?.tokens["color.primary.ocean"] as ResolvedToken<TokenType>).$value).toBe(
            "#0000FF"
        );

        // Ocean-dark context
        const oceanDarkTree = result.find((t) => t.context === "ocean-dark");
        expect(
            (oceanDarkTree?.tokens["color.primary.ocean.dark"] as ResolvedToken<TokenType>).$value
        ).toBe("#000088");
    });
});
