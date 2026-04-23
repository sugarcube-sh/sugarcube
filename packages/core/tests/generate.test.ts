import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/node/config/normalize.js";
import { formatCSSVariables } from "../src/shared/pipeline/format-css-variables.js";
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

        const result = await formatCSSVariables(tokens, config);
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

        const result = await formatCSSVariables(tokens, config);

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

        const result = await formatCSSVariables(tokens, config);

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

        const result = await formatCSSVariables(tokens, config);
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

        const result = await formatCSSVariables(tokens, config);
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

        const result = await formatCSSVariables(tokens, config);
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

        const result = await formatCSSVariables(tokens, config);

        expect(result.output).toHaveLength(1);
        expect(result.output[0]?.css).toContain("--color-primary: #FF0000;");
    });

    it("should return empty output when no permutations defined", async () => {
        const tokens: NormalizedConvertedTokens = {};
        const config = fillDefaults(configs.basic);

        const result = await formatCSSVariables(tokens, config);

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

            const result = await formatCSSVariables(tokens, config);
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

            const result = await formatCSSVariables(tokens, config);
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

            const result = await formatCSSVariables(tokens, config);

            expect(result.output).toHaveLength(2);
            expect(result.output[0]?.path).toBe("dist/ocean.css");
            expect(result.output[0]?.css).toContain("#0066FF");
            expect(result.output[1]?.path).toBe("dist/forest.css");
            expect(result.output[1]?.css).toContain("#00FF66");
        });
    });

    describe("prefix", () => {
        it("emits the prefixed name in declarations, references, and typography sub-vars", async () => {
            const tokens: NormalizedConvertedTokens = {
                "perm:0": {
                    "color.primary": createConvertedToken({
                        $path: "color.primary",
                        $names: { css: "ds-color-primary" },
                    }),
                    "color.button": createConvertedToken({
                        $path: "color.button",
                        $value: "{color.primary}",
                        $cssProperties: { value: "{color.primary}" },
                        $names: { css: "ds-color-button" },
                    }),
                    "typography.body": createConvertedToken({
                        $type: "typography",
                        $path: "typography.body",
                        $value: {
                            fontFamily: "Arial",
                            fontSize: "16px",
                            lineHeight: 1.5,
                            fontWeight: 400,
                        },
                        $cssProperties: {
                            "font-family": "Arial",
                            "font-size": "16px",
                            "line-height": 1.5,
                            "font-weight": 400,
                        },
                        $names: { css: "ds-typography-body" },
                    }),
                },
            };

            const config = configWith("basic", [{ input: {}, selector: ":root" }]);
            const css = (await formatCSSVariables(tokens, config)).output[0]?.css ?? "";

            expect(css).toContain("--ds-color-primary: #FF0000;");
            expect(css).toContain("--ds-color-button: var(--ds-color-primary);");
            expect(css).toContain("--ds-typography-body-font-family: Arial;");
        });
    });

    describe("path case preservation", () => {
        // Declarations and references must use the same var name even when
        // path segments contain camelCase characters. Pre-$names, declarations
        // preserved case (--color-brandPrimary) while references kebab-cased
        // (var(--color-brand-primary)) — producing a dangling reference.
        it("keeps declaration and reference names in sync for camelCase paths", async () => {
            const tokens: NormalizedConvertedTokens = {
                "perm:0": {
                    "color.brandPrimary": createConvertedToken({
                        $path: "color.brandPrimary",
                        $value: "#FF0000",
                        $resolvedValue: "#FF0000",
                        $cssProperties: { value: "#FF0000" },
                    }),
                    "color.button": createConvertedToken({
                        $path: "color.button",
                        $value: "{color.brandPrimary}",
                        $resolvedValue: "#FF0000",
                        $cssProperties: { value: "{color.brandPrimary}" },
                    }),
                },
            };

            const config = configWith("basic", [{ input: {}, selector: ":root" }]);
            const css = (await formatCSSVariables(tokens, config)).output[0]?.css ?? "";

            expect(css).toContain("--color-brandPrimary: #FF0000;");
            expect(css).toContain("--color-button: var(--color-brandPrimary);");
        });
    });

    describe("$root tokens", () => {
        // DTCG 2025.10 §6.2: a $root token represents the group's base value.
        // Its CSS variable should be the group's path — "$root" is a reference-only
        // disambiguator and must not appear in emitted identifiers.
        it("emits $root tokens using the group path without a $root segment", async () => {
            const tokens: NormalizedConvertedTokens = {
                "perm:0": {
                    "blue.$root": createConvertedToken({
                        $value: "#0000FF",
                        $path: "blue.$root",
                        $originalPath: "blue.$root",
                        $resolvedValue: "#0000FF",
                        $cssProperties: { value: "#0000FF" },
                    }),
                    "blue.50": createConvertedToken({
                        $value: "#ADD8E6",
                        $path: "blue.50",
                        $originalPath: "blue.50",
                        $resolvedValue: "#ADD8E6",
                        $cssProperties: { value: "#ADD8E6" },
                    }),
                },
            };

            const config = configWith("basic", [{ input: {}, selector: ":root" }]);

            const result = await formatCSSVariables(tokens, config);
            const css = result.output[0]?.css ?? "";

            expect(css).toContain("--blue: #0000FF;");
            expect(css).toContain("--blue-50: #ADD8E6;");
            expect(css).not.toContain("$root");
        });

        // References to a $root token (e.g. {blue.$root}) must emit the group's
        // CSS variable — var(--blue) — not var(--blue-$root).
        it("emits var(--…) references to $root tokens using the group path", async () => {
            const tokens: NormalizedConvertedTokens = {
                "perm:0": {
                    "blue.$root": createConvertedToken({
                        $value: "#0000FF",
                        $path: "blue.$root",
                        $originalPath: "blue.$root",
                        $resolvedValue: "#0000FF",
                        $cssProperties: { value: "#0000FF" },
                    }),
                    "border.primary": createConvertedToken({
                        $value: "{blue.$root}",
                        $path: "border.primary",
                        $originalPath: "border.primary",
                        $resolvedValue: "#0000FF",
                        $cssProperties: { value: "{blue.$root}" },
                    }),
                },
            };

            const config = configWith("basic", [{ input: {}, selector: ":root" }]);

            const result = await formatCSSVariables(tokens, config);
            const css = result.output[0]?.css ?? "";

            expect(css).toContain("--border-primary: var(--blue);");
            expect(css).not.toContain("$root");
        });
    });
});
