import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/config/normalize-config.js";
import { generate } from "../src/pipeline/generate.js";
import type { NormalizedConvertedTokens } from "../src/types/convert.js";
import { configs } from "./__fixtures__/configs.js";
import { convertedTokens, createConvertedToken } from "./__fixtures__/converted-tokens.js";

describe("generate", () => {
    it("should generate basic CSS variables", async () => {
        const tokens: NormalizedConvertedTokens = {
            default: {
                "color.primary": convertedTokens.colorPrimary,
            },
        };

        const result = await generate(tokens, fillDefaults(configs.basic));
        const css = result.output[0]?.css ?? "";

        expect(css).toContain(":root {");
        expect(css).toContain("--color-primary: #FF0000;");
    });

    it("should handle theme context tokens", async () => {
        const tokens: NormalizedConvertedTokens = {
            default: {
                "color.primary": convertedTokens.colorPrimary,
            },
            dark: {
                "color.primary": convertedTokens.colorPrimaryDark,
            },
        };

        const config = fillDefaults(configs.themes);

        const result = await generate(tokens, config);

        expect(result.output).toHaveLength(1);

        const css = result.output[0]?.css ?? "";
        expect(css).toContain(":root {");
        expect(css).toContain("--color-primary: #FF0000;");
        expect(css).toContain('[data-theme="dark"] {');
        expect(css).toContain("--color-primary: #000000;");
    });

    it("should handle named theme contexts", async () => {
        const tokens: NormalizedConvertedTokens = {
            default: {
                "color.primary": convertedTokens.colorPrimary,
            },
            ocean: {
                "color.primary": createConvertedToken({
                    $value: "#0066FF",
                    $resolvedValue: "#0066FF",
                    $cssProperties: { value: "#0066FF" },
                }),
            },
        };

        const config = fillDefaults(configs.themes);

        const result = await generate(tokens, config);

        const css = result.output[0]?.css ?? "";
        expect(css).toContain(":root {");
        expect(css).toContain("--color-primary: #FF0000;");
        expect(css).toContain('[data-theme="ocean"] {');
        expect(css).toContain("--color-primary: #0066FF;");
    });

    it("should handle typography tokens", async () => {
        const tokens: NormalizedConvertedTokens = {
            default: {
                "typography.body": convertedTokens.typographyBody,
            },
        };

        const result = await generate(tokens, fillDefaults(configs.basic));
        const css = result.output[0]?.css ?? "";

        expect(css).toContain("--typography-body-font-family: Arial;");
        expect(css).toContain("--typography-body-font-size: 16px;");
        expect(css).toContain("--typography-body-line-height: 1.5;");
        expect(css).toContain("--typography-body-font-weight: 400;");
    });

    it("should handle P3 color support", async () => {
        const tokens: NormalizedConvertedTokens = {
            default: {
                "color.primary": createConvertedToken({
                    $cssProperties: {
                        value: "#FF0000",
                        featureValues: [
                            {
                                query: "@supports (color: color(display-p3 1 1 1))",
                                value: "color(display-p3 1 0 0)",
                            },
                        ],
                    },
                }),
            },
        };

        const result = await generate(tokens, fillDefaults(configs.colorsP3));
        const css = result.output[0]?.css ?? "";

        expect(css).toContain("--color-primary: #FF0000;");
        expect(css).toContain("@supports (color: color(display-p3 1 1 1))");
        expect(css).toContain("--color-primary: color(display-p3 1 0 0);");
    });

    it("should handle references in CSS values", async () => {
        const tokens: NormalizedConvertedTokens = {
            default: {
                "color.primary": convertedTokens.colorPrimary,
                "shadow.primary": convertedTokens.shadowPrimary,
            },
        };

        const result = await generate(tokens, fillDefaults(configs.basic));
        const css = result.output[0]?.css ?? "";

        expect(css).toContain("--shadow-primary: 0px 2px 4px 0px var(--color-primary);");
    });

    it("should handle contexts with only metadata", async () => {
        const tokens: NormalizedConvertedTokens = {
            default: {
                "color.primary": convertedTokens.colorPrimary,
            },
            empty: {}, // Truly empty context
            metadataOnly: {
                color: {
                    $description: "Color tokens",
                    $extensions: {
                        custom: "value",
                    },
                },
            },
        };

        const result = await generate(tokens, fillDefaults(configs.basic));

        expect(result.output).toHaveLength(1);
        expect(result.output[0]?.css).toContain("--color-primary: #FF0000;");
    });

    it("should filter out contexts with no tokens", async () => {
        const tokens: NormalizedConvertedTokens = {
            default: {
                "color.primary": createConvertedToken({
                    $source: { sourcePath: "tokens.json" },
                }),
            },
            empty: {},
            metadataOnly: {
                metadata: {
                    $description: "This is a metadata node",
                    $extensions: {
                        custom: "value",
                    },
                },
            },
        };

        const result = await generate(tokens, fillDefaults(configs.basic));

        expect(result.output).toHaveLength(1);
        expect(result.output[0]?.path).toBe("src/css/global/tokens.variables.gen.css");
        expect(result.output[0]?.css).toContain("--color-primary: #FF0000");
    });
});
