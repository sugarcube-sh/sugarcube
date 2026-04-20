import { describe, expect, it } from "vitest";
import { groupByContext } from "../src/shared/pipeline/group-by-context.js";
import type { ResolvedToken } from "../src/types/resolve.js";
import type { NodeMetadata, TokenType } from "../src/types/tokens.js";

describe("groupByContext", () => {
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

        const result = groupByContext(trees, resolved);

        expect((result.default?.["color.background"] as ResolvedToken<TokenType>)?.$value).toBe(
            "#FFFFFF"
        );
        expect(result.default?.["color.background.dark"]).toBeUndefined();
        expect((result.dark?.["color.background.dark"] as ResolvedToken<TokenType>)?.$value).toBe(
            "#000000"
        );
        expect(result.dark?.["color.background"]).toBeUndefined();
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

        const result = groupByContext(trees, resolved);

        for (const bucket of Object.values(result)) {
            expect(bucket.color?.$description).toBe("Color tokens");
        }
    });

    it("should handle empty trees", () => {
        const trees = [
            { sourcePath: "tokens.json", tokens: {} },
            { context: "dark", sourcePath: "tokens.json", tokens: {} },
        ];
        const result = groupByContext(trees, {});

        expect(result).toEqual({ default: {}, dark: {} });
    });

    it("should drop tokens whose context is not represented in trees", () => {
        const trees = [{ sourcePath: "tokens.json", tokens: {} }];
        const resolved = {
            token1: {
                $type: "color",
                $value: "#FF0000",
                $source: { context: "dark", sourcePath: "dark.json" },
            } as ResolvedToken<TokenType>,
        };

        const result = groupByContext(trees, resolved);
        // "dark" context gets created because the resolved token claims it
        expect(result.default).toEqual({});
        expect(result.dark).toBeDefined();
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

        const result = groupByContext(trees, resolved);

        expect((result.default?.["color.primary"] as ResolvedToken<TokenType>).$value).toBe(
            "#FF0000"
        );
        expect((result.dark?.["color.primary.dark"] as ResolvedToken<TokenType>).$value).toBe(
            "#880000"
        );
        expect((result.ocean?.["color.primary.ocean"] as ResolvedToken<TokenType>).$value).toBe(
            "#0000FF"
        );
        expect(
            (result["ocean-dark"]?.["color.primary.ocean.dark"] as ResolvedToken<TokenType>).$value
        ).toBe("#000088");
    });
});
