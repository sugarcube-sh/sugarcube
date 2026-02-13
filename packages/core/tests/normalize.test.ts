import { describe, expect, it } from "vitest";
import { normalizeTokens } from "../src/pipeline/normalize.js";
import type { ProcessedTree } from "../src/types/process-trees.js";
import type { ResolvedToken, ResolvedTokens } from "../src/types/resolve.js";
import type { TokenType } from "../src/types/tokens.js";

describe("normalizeTokens", () => {
    it("should normalize processed trees into context-based structure", () => {
        const trees: ProcessedTree[] = [
            {
                tokens: {
                    "color.primary": {
                        $type: "color",
                        $value: "#FF0000",
                        $path: "color.primary",
                        $originalPath: "color.primary",
                        $resolvedValue: "#FF0000",
                        $source: { sourcePath: "tokens.json" },
                    } as ResolvedToken<TokenType>,
                },
            },
            {
                context: "dark",
                tokens: {
                    "color.primary": {
                        $type: "color",
                        $value: "#000000",
                        $path: "color.primary",
                        $originalPath: "color.primary",
                        $resolvedValue: "#000000",
                        $source: { sourcePath: "tokens.json" },
                    } as ResolvedToken<TokenType>,
                },
            },
        ];

        const result = normalizeTokens(trees, "default");

        expect(result.tokens.default?.["color.primary"]).toBeDefined();
        expect((result.tokens.default?.["color.primary"] as ResolvedToken<TokenType>).$value).toBe(
            "#FF0000"
        );
        expect(result.tokens.dark?.["color.primary"]).toBeDefined();
        expect((result.tokens.dark?.["color.primary"] as ResolvedToken<TokenType>).$value).toBe(
            "#000000"
        );
        expect(result.defaultContext).toBe("default");
    });

    it("should handle empty trees", () => {
        const trees: ProcessedTree[] = [{ tokens: {} }, { context: "dark", tokens: {} }];

        const result = normalizeTokens(trees);
        expect(result.tokens).toEqual({ default: {}, dark: {} });
    });

    it("should preserve token keys unchanged", () => {
        const trees: ProcessedTree[] = [
            {
                tokens: {
                    "color.primary": {
                        $type: "color",
                        $value: "#FF0000",
                        $path: "color.primary",
                        $originalPath: "color.primary",
                        $resolvedValue: "#FF0000",
                        $source: { sourcePath: "tokens.json" },
                    } as ResolvedToken<TokenType>,
                },
            },
        ];

        const result = normalizeTokens(trees);

        expect(result.tokens.default?.["color.primary"]).toBeDefined();
    });

    it("should handle context variations", () => {
        const trees: ProcessedTree[] = [
            {
                context: "ocean",
                tokens: {
                    "color.primary": {
                        $type: "color",
                        $value: "#0066FF",
                        $path: "color.primary",
                        $originalPath: "color.primary",
                        $resolvedValue: "#0066FF",
                        $source: { sourcePath: "tokens.json" },
                    } as ResolvedToken<TokenType>,
                },
            },
        ];

        const result = normalizeTokens(trees, "light");

        expect((result.tokens.ocean?.["color.primary"] as ResolvedToken<TokenType>).$value).toBe(
            "#0066FF"
        );
        expect(result.defaultContext).toBe("light");
    });
});
