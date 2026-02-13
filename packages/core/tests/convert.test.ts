import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/config/normalize-config.js";
import { convert } from "../src/pipeline/convert.js";
import type { ConvertedToken } from "../src/types/convert.js";
import type { NormalizedTokens } from "../src/types/normalize.js";
import type { ResolvedToken } from "../src/types/resolve.js";
import type { NodeMetadata, TokenType } from "../src/types/tokens.js";
import { configs } from "./__fixtures__/configs.js";
import { createResolvedToken } from "./__fixtures__/resolved-tokens.js";

describe("convert", () => {
    it("should skip unsupported token types", () => {
        const tokens: NormalizedTokens = {
            default: {
                "color.primary": createResolvedToken(),
                "unsupported.type": {
                    $type: "notARealType" as TokenType,
                    $value: "something",
                    $path: "unsupported.type",
                    $source: { sourcePath: "test.json" },
                    $originalPath: "unsupported.type",
                    $resolvedValue: "something",
                } as ResolvedToken<TokenType>,
            },
        };

        const result = convert(tokens, fillDefaults(configs.basic));
        expect(result.default?.["color.primary"]).toBeDefined();
        expect(result.default?.["unsupported.type"]).toBeUndefined();
    });

    it("should handle invalid tokens", () => {
        const tokens: NormalizedTokens = {
            default: {
                "color.primary": null as any,
                "color.secondary": undefined as any,
                "color.tertiary": "not an object" as any,
                "color.valid": createResolvedToken({
                    $path: "color.valid",
                    $originalPath: "color.valid",
                }),
            },
        };

        const result = convert(tokens, fillDefaults(configs.basic));
        expect(result.default?.["color.primary"]).toBeUndefined();
        expect(result.default?.["color.secondary"]).toBeUndefined();
        expect(result.default?.["color.tertiary"]).toBeUndefined();
        expect(result.default?.["color.valid"]).toBeDefined();
    });

    it("should preserve metadata and extensions", () => {
        const tokens: NormalizedTokens = {
            default: {
                "color": {
                    $type: "color",
                    $description: "Color tokens",
                    $extensions: {
                        custom: "value",
                    },
                    $path: "color",
                } as NodeMetadata,
                "color.primary": createResolvedToken({
                    $description: "Primary color",
                    $extensions: { custom: "value" },
                }),
            },
        };

        const result = convert(tokens, fillDefaults(configs.basic));

        const metadataNode = result.default?.color as NodeMetadata;
        expect(metadataNode.$description).toBe("Color tokens");
        expect(metadataNode.$extensions?.custom).toBe("value");

        const token = result.default?.["color.primary"] as ResolvedToken<TokenType>;
        expect(token.$description).toBe("Primary color");
        expect(token.$extensions?.custom).toBe("value");
    });

    it("should handle conversion options correctly", () => {
        const tokens: NormalizedTokens = {
            default: {
                "color.primary": createResolvedToken(),
            },
        };

        const result = convert(tokens, fillDefaults(configs.colorsRgb));

        const token = result.default?.["color.primary"] as ConvertedToken<TokenType>;
        expect(token.$cssProperties).toBeDefined();
        // We don't test the exact CSS properties here as that's covered by the individual converter tests
    });
});
