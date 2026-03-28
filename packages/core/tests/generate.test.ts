import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/config/normalize-config.js";
import { generate } from "../src/pipeline/generate.js";
import type { InternalConfig } from "../src/types/config.js";
import type { NormalizedConvertedTokens } from "../src/types/convert.js";
import { configs } from "./__fixtures__/configs.js";
import { convertedTokens, createConvertedToken } from "./__fixtures__/converted-tokens.js";

function configWith(
    base: keyof typeof configs,
    permutations: InternalConfig["variables"]["permutations"]
): InternalConfig {
    const baseConfig = fillDefaults(configs[base]);
    return {
        ...baseConfig,
        variables: {
            ...baseConfig.variables,
            permutations,
        },
    };
}

describe("generate", () => {
    it("should generate basic CSS variables", async () => {
        const tokens: NormalizedConvertedTokens = {
            "perm:0": {
                "color.primary": convertedTokens.colorPrimary,
            },
        };

        const config = configWith("basic", [{ input: {}, selector: ":root" }]);

        const result = await generate(tokens, config);
        const css = result.output[0]?.css ?? "";

        expect(css).toContain(":root {");
        expect(css).toContain("--color-primary: #FF0000;");
    });

    it("should handle theme context tokens", async () => {
        const tokens: NormalizedConvertedTokens = {
            "perm:0": {
                "color.primary": convertedTokens.colorPrimary,
            },
            "perm:1": {
                "color.primary": convertedTokens.colorPrimaryDark,
            },
        };

        const config = configWith("themes", [
            { input: { theme: "light" }, selector: ":root" },
            { input: { theme: "dark" }, selector: '[data-theme="dark"]' },
        ]);

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
            "perm:0": {
                "color.primary": convertedTokens.colorPrimary,
            },
            "perm:1": {
                "color.primary": createConvertedToken({
                    $value: "#0066FF",
                    $resolvedValue: "#0066FF",
                    $cssProperties: { value: "#0066FF" },
                }),
            },
        };

        const config = configWith("themes", [
            { input: { theme: "light" }, selector: ":root" },
            { input: { theme: "ocean" }, selector: '[data-theme="ocean"]' },
        ]);

        const result = await generate(tokens, config);

        const css = result.output[0]?.css ?? "";
        expect(css).toContain(":root {");
        expect(css).toContain("--color-primary: #FF0000;");
        expect(css).toContain('[data-theme="ocean"] {');
        expect(css).toContain("--color-primary: #0066FF;");
    });

    it("should handle typography tokens", async () => {
        const tokens: NormalizedConvertedTokens = {
            "perm:0": {
                "typography.body": convertedTokens.typographyBody,
            },
        };

        const config = configWith("basic", [{ input: {}, selector: ":root" }]);

        const result = await generate(tokens, config);
        const css = result.output[0]?.css ?? "";

        expect(css).toContain("--typography-body-font-family: Arial;");
        expect(css).toContain("--typography-body-font-size: 16px;");
        expect(css).toContain("--typography-body-line-height: 1.5;");
        expect(css).toContain("--typography-body-font-weight: 400;");
    });

    it("should handle P3 color support", async () => {
        const tokens: NormalizedConvertedTokens = {
            "perm:0": {
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

        const config = configWith("colorsP3", [{ input: {}, selector: ":root" }]);

        const result = await generate(tokens, config);
        const css = result.output[0]?.css ?? "";

        expect(css).toContain("--color-primary: #FF0000;");
        expect(css).toContain("@supports (color: color(display-p3 1 1 1))");
        expect(css).toContain("--color-primary: color(display-p3 1 0 0);");
    });

    it("should handle references in CSS values", async () => {
        const tokens: NormalizedConvertedTokens = {
            "perm:0": {
                "color.primary": convertedTokens.colorPrimary,
                "shadow.primary": convertedTokens.shadowPrimary,
            },
        };

        const config = configWith("basic", [{ input: {}, selector: ":root" }]);

        const result = await generate(tokens, config);
        const css = result.output[0]?.css ?? "";

        expect(css).toContain("--shadow-primary: 0px 2px 4px 0px var(--color-primary);");
    });

    it("should skip empty permutations", async () => {
        const tokens: NormalizedConvertedTokens = {
            "perm:0": {
                "color.primary": convertedTokens.colorPrimary,
            },
            "perm:1": {},
        };

        const config = configWith("basic", [
            { input: {}, selector: ":root" },
            { input: { theme: "dark" }, selector: '[data-theme="dark"]' },
        ]);

        const result = await generate(tokens, config);

        expect(result.output).toHaveLength(1);
        expect(result.output[0]?.css).toContain("--color-primary: #FF0000;");
    });

    it("should return empty output when no permutations defined", async () => {
        const tokens: NormalizedConvertedTokens = {};
        const config = fillDefaults(configs.basic);

        const result = await generate(tokens, config);

        expect(result.output).toHaveLength(0);
    });

    describe("permutations API", () => {
        it("should generate media query when permutation has atRule", async () => {
            const tokens: NormalizedConvertedTokens = {
                "perm:0": {
                    "color.surface": createConvertedToken({
                        $path: "color.surface",
                        $cssProperties: { value: "#ffffff" },
                    }),
                },
                "perm:1": {
                    "color.surface": createConvertedToken({
                        $path: "color.surface",
                        $cssProperties: { value: "#1a1a1a" },
                    }),
                },
            };

            const config = configWith("basic", [
                { input: { theme: "light" }, selector: ":root" },
                {
                    input: { theme: "dark" },
                    selector: ":root",
                    atRule: "@media (prefers-color-scheme: dark)",
                },
            ]);

            const result = await generate(tokens, config);
            const css = result.output[0]?.css ?? "";

            expect(css).toContain(":root {");
            expect(css).toContain("--color-surface: #ffffff;");
            expect(css).toContain("@media (prefers-color-scheme: dark) {");
            expect(css).toContain("--color-surface: #1a1a1a;");
            expect(css).not.toContain('[data-theme="dark"]');
        });

        it("should use inline permutation from --input (CLI converts input to permutation)", async () => {
            const tokens: NormalizedConvertedTokens = {
                "perm:0": {
                    "color.primary": createConvertedToken({
                        $path: "color.primary",
                        $cssProperties: { value: "#0066FF" },
                    }),
                },
            };

            const config = configWith("basic", [
                { input: { brand: "ocean" }, selector: "[data-brand='ocean']" },
            ]);

            const result = await generate(tokens, config);
            const css = result.output[0]?.css ?? "";

            expect(css).toContain("[data-brand='ocean'] {");
            expect(css).toContain("--color-primary: #0066FF;");
        });

        it("should group permutations by path", async () => {
            const tokens: NormalizedConvertedTokens = {
                "perm:0": {
                    "color.primary": createConvertedToken({
                        $path: "color.primary",
                        $cssProperties: { value: "#0066FF" },
                    }),
                },
                "perm:1": {
                    "color.primary": createConvertedToken({
                        $path: "color.primary",
                        $cssProperties: { value: "#00FF66" },
                    }),
                },
            };

            const config = configWith("basic", [
                { input: { brand: "ocean" }, selector: ":root", path: "dist/ocean.css" },
                { input: { brand: "forest" }, selector: ":root", path: "dist/forest.css" },
            ]);

            const result = await generate(tokens, config);

            expect(result.output).toHaveLength(2);
            expect(result.output[0]?.path).toBe("dist/ocean.css");
            expect(result.output[0]?.css).toContain("#0066FF");
            expect(result.output[1]?.path).toBe("dist/forest.css");
            expect(result.output[1]?.css).toContain("#00FF66");
        });
    });
});
