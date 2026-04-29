import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { assignCSSNames } from "../src/shared/pipeline/assign-css-names.js";
import type { NormalizedTokens } from "../src/types/normalize.js";
import type { RenderableToken } from "../src/types/render.js";
import type { ResolvedToken } from "../src/types/resolve.js";
import type { NodeMetadata, TokenType } from "../src/types/tokens.js";
import { configs } from "./__fixtures__/configs.js";
import { createResolvedToken } from "./__fixtures__/resolved-tokens.js";

describe("convert", () => {
    it("should drop tokens flagged as invalid by validation", () => {
        // Unknown $type is caught by the validation step; assignCSSNames
        // consumes the validation error via isTokenInvalid and drops the token.
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

        const validationErrors = [
            {
                path: "unsupported.type",
                message: "unknown token type",
                source: { sourcePath: "test.json" },
            },
        ];
        const result = assignCSSNames(tokens, fillDefaults(configs.basic), validationErrors);
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

        const result = assignCSSNames(tokens, fillDefaults(configs.basic));
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

        const result = assignCSSNames(tokens, fillDefaults(configs.basic));

        const metadataNode = result.default?.color as NodeMetadata;
        expect(metadataNode.$description).toBe("Color tokens");
        expect(metadataNode.$extensions?.custom).toBe("value");

        const token = result.default?.["color.primary"] as ResolvedToken<TokenType>;
        expect(token.$description).toBe("Primary color");
        expect(token.$extensions?.custom).toBe("value");
    });

    it("populates $names.css from the token path", () => {
        const tokens: NormalizedTokens = {
            default: {
                "color.primary": createResolvedToken(),
            },
        };

        const result = assignCSSNames(tokens, fillDefaults(configs.basic));

        const token = result.default?.["color.primary"] as RenderableToken<TokenType>;
        expect(token.$names.css).toBe("color-primary");
    });

    it("applies the variables.prefix config to $names.css", () => {
        const tokens: NormalizedTokens = {
            default: {
                "color.primary": createResolvedToken(),
            },
        };

        const result = assignCSSNames(tokens, fillDefaults({ variables: { prefix: "ds" } }));

        const token = result.default?.["color.primary"] as RenderableToken<TokenType>;
        expect(token.$names.css).toBe("ds-color-primary");
    });

    it("uses variables.variableName callback when set", () => {
        const tokens: NormalizedTokens = {
            default: {
                "color.primary": createResolvedToken(),
            },
        };

        const result = assignCSSNames(
            tokens,
            fillDefaults({
                variables: {
                    variableName: (path) => `custom--${path.replaceAll(".", "_")}`,
                },
            })
        );

        const token = result.default?.["color.primary"] as RenderableToken<TokenType>;
        expect(token.$names.css).toBe("custom--color_primary");
    });

    it("variableName overrides prefix when both are set", () => {
        const tokens: NormalizedTokens = {
            default: {
                "color.primary": createResolvedToken(),
            },
        };

        const result = assignCSSNames(
            tokens,
            fillDefaults({
                variables: {
                    prefix: "ignored",
                    variableName: (path) => `only-${path.replaceAll(".", "-")}`,
                },
            })
        );

        const token = result.default?.["color.primary"] as RenderableToken<TokenType>;
        expect(token.$names.css).toBe("only-color-primary");
    });
});
