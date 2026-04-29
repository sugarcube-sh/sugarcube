import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/node/config/normalize.js";
import { loadTokens } from "../src/node/load-tokens.js";
import { generateCSSVariables } from "../src/shared/generate-css-variables.js";
import { assignCSSNames } from "../src/shared/pipeline/assign-css-names.js";
import { groupByContext } from "../src/shared/pipeline/group-by-context.js";
import { resolveTokens } from "../src/shared/resolve-tokens.js";
import type { InternalConfig } from "../src/types/config.js";

const FIXTURES_DIR = resolve(__dirname, "__fixtures__/resolver");

async function generateCSS(config: InternalConfig): Promise<string> {
    const loaded = await loadTokens({
        type: "resolver",
        resolverPath: config.resolver as string,
        config,
    });

    expect(loaded.errors).toHaveLength(0);

    const resolved = resolveTokens(loaded.trees);
    const converted = assignCSSNames(groupByContext(resolved.trees, resolved.resolved), config);
    const output = await generateCSSVariables(converted, config);

    return output.map((f) => f.css).join("\n");
}

describe("permutations", () => {
    describe("single modifier, single permutation (--input)", () => {
        it("outputs tokens at :root for default input", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "simple.resolver.json"),
                variables: {
                    permutations: [{ input: { theme: "light" }, selector: ":root" }],
                },
            });

            const css = await generateCSS(config);

            expect(css).toContain(":root {");
            expect(css).toContain("--color-primary:");
        });

        it("outputs non-default context tokens at custom selector", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "simple.resolver.json"),
                variables: {
                    permutations: [{ input: { theme: "dark" }, selector: "[data-theme='dark']" }],
                },
            });

            const css = await generateCSS(config);

            expect(css).toContain("[data-theme='dark']");
        });
    });

    describe("two modifiers, single permutation (--input brand=x --input theme=dark)", () => {
        it("resolves both modifiers into a single output", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "multiple-modifiers.resolver.json"),
                variables: {
                    permutations: [
                        {
                            input: { theme: "dark", density: "compact" },
                            selector: ":root",
                        },
                    ],
                },
            });

            const css = await generateCSS(config);

            // Should have both dark colors AND compact spacing
            expect(css).toContain(":root {");
            expect(css).toContain("--color-primary: #60a5fa;");
            expect(css).toContain("--spacing-md: 8px;");
        });
    });

    describe("delta optimization", () => {
        it("non-first permutations only output tokens that differ from the first", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "multiple-modifiers.resolver.json"),
                variables: {
                    permutations: [
                        { input: { theme: "light", density: "normal" }, selector: ":root" },
                        {
                            input: { theme: "dark", density: "normal" },
                            selector: "[data-theme='dark']",
                        },
                        {
                            input: { theme: "light", density: "compact" },
                            selector: "[data-density='compact']",
                        },
                    ],
                },
            });

            const css = await generateCSS(config);

            // :root should have everything
            expect(css).toContain(":root {");
            expect(css).toContain("--color-primary:");
            expect(css).toContain("--spacing-md:");

            // Dark block should only have color overrides, NOT spacing
            const darkSection = css.split("[data-theme='dark']")[1]?.split("}")[0] ?? "";
            expect(darkSection).toContain("--color-primary:");
            expect(darkSection).not.toContain("--spacing-");

            // Compact block should only have spacing overrides, NOT colors
            const compactSection = css.split("[data-density='compact']")[1]?.split("}")[0] ?? "";
            expect(compactSection).toContain("--spacing-");
            expect(compactSection).not.toContain("--color-");
        });
    });

    describe("same input, different selectors", () => {
        it("outputs the same permutation under multiple selectors", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "simple.resolver.json"),
                variables: {
                    permutations: [
                        { input: { theme: "light" }, selector: ":root" },
                        { input: { theme: "dark" }, selector: "[data-theme='dark']" },
                        {
                            input: { theme: "dark" },
                            selector: ":root",
                            atRule: "@media (prefers-color-scheme: dark)",
                        },
                    ],
                },
            });

            const css = await generateCSS(config);

            expect(css).toContain(":root {");
            expect(css).toContain("[data-theme='dark']");
            expect(css).toContain("@media (prefers-color-scheme: dark)");
        });
    });

    describe("validation", () => {
        it("errors on unknown modifier name in permutation input", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "simple.resolver.json"),
                variables: {
                    permutations: [{ input: { nonexistent: "value" }, selector: ":root" }],
                },
            });

            const loaded = await loadTokens({
                type: "resolver",
                resolverPath: config.resolver as string,
                config,
            });

            expect(loaded.errors.length).toBeGreaterThan(0);
            expect(loaded.errors[0]?.message).toContain("nonexistent");
        });

        it("errors on invalid context value in permutation input", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "simple.resolver.json"),
                variables: {
                    permutations: [{ input: { theme: "nonexistent" }, selector: ":root" }],
                },
            });

            const loaded = await loadTokens({
                type: "resolver",
                resolverPath: config.resolver as string,
                config,
            });

            expect(loaded.errors.length).toBeGreaterThan(0);
            expect(loaded.errors[0]?.message).toContain("nonexistent");
        });
    });

    describe("per-permutation output paths", () => {
        it("outputs permutations with different paths to separate files", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "simple.resolver.json"),
                variables: {
                    permutations: [
                        { input: { theme: "light" }, selector: ":root", path: "dist/light.css" },
                        { input: { theme: "dark" }, selector: ":root", path: "dist/dark.css" },
                    ],
                },
            });

            const loaded = await loadTokens({
                type: "resolver",
                resolverPath: config.resolver as string,
                config,
            });

            expect(loaded.errors).toHaveLength(0);

            const resolved = resolveTokens(loaded.trees);
            const converted = assignCSSNames(
                groupByContext(resolved.trees, resolved.resolved),
                config
            );
            const output = await generateCSSVariables(converted, config);

            expect(output).toHaveLength(2);
            expect(output[0]?.path).toBe("dist/light.css");
            expect(output[1]?.path).toBe("dist/dark.css");

            // Each file should have :root with different values
            expect(output[0]?.css).toContain(":root {");
            expect(output[1]?.css).toContain(":root {");
        });
    });

    describe("non-orthogonal modifiers (brand-specific theme contexts)", () => {
        it("composes brand + brand-specific dark theme correctly", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "non-orthogonal-modifiers.resolver.json"),
                variables: {
                    permutations: [
                        { input: { brand: "default", theme: "light" }, selector: ":root" },
                        {
                            input: { brand: "ocean", theme: "dark-ocean" },
                            selector: "[data-brand='ocean'][data-theme='dark']",
                        },
                        {
                            input: { brand: "forest", theme: "dark-forest" },
                            selector: "[data-brand='forest'][data-theme='dark']",
                        },
                    ],
                },
            });

            const css = await generateCSS(config);

            // :root should have base values
            expect(css).toContain("--color-primary: #3b82f6;");
            expect(css).toContain("--color-surface: #ffffff;");

            // ocean dark should have ocean's primary, ocean-specific dark surface, AND shared dark text
            const oceanDarkSection =
                css.split("[data-brand='ocean'][data-theme='dark']")[1]?.split("}")[0] ?? "";
            expect(oceanDarkSection).toContain("--color-primary: #0ea5e9;");
            expect(oceanDarkSection).toContain("--color-surface: #0c2d3f;");
            expect(oceanDarkSection).toContain("--color-text: #ffffff;");

            // forest dark should have forest's primary, forest-specific dark surface, AND shared dark text
            const forestDarkSection =
                css.split("[data-brand='forest'][data-theme='dark']")[1]?.split("}")[0] ?? "";
            expect(forestDarkSection).toContain("--color-primary: #16a34a;");
            expect(forestDarkSection).toContain("--color-surface: #1a2e1a;");
            expect(forestDarkSection).toContain("--color-text: #ffffff;");
        });

        it("brand-specific dark contexts don't affect other brands", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "non-orthogonal-modifiers.resolver.json"),
                variables: {
                    permutations: [
                        { input: { brand: "default", theme: "light" }, selector: ":root" },
                        {
                            input: { brand: "default", theme: "dark" },
                            selector: "[data-theme='dark']",
                        },
                    ],
                },
            });

            const css = await generateCSS(config);

            // Generic dark should have generic dark surface, not ocean or forest
            const darkSection = css.split("[data-theme='dark']")[1]?.split("}")[0] ?? "";
            expect(darkSection).toContain("--color-surface: #1a1a1a;");
            expect(darkSection).not.toContain("#0c2d3f");
            expect(darkSection).not.toContain("#1a2e1a");
        });
    });

    describe("auto-generated permutations (no config)", () => {
        it("generates :root for defaults and data-attribute selectors for non-defaults", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "simple.resolver.json"),
            });

            const css = await generateCSS(config);

            // Default context should be at :root
            expect(css).toContain(":root {");
            // Non-default context should get a data-attribute selector
            expect(css).toContain('[data-theme="dark"]');
        });

        it("generates correct selectors for multiple modifiers", async () => {
            const config = validateConfig({
                resolver: resolve(FIXTURES_DIR, "multiple-modifiers.resolver.json"),
            });

            const css = await generateCSS(config);

            expect(css).toContain(":root {");
            expect(css).toContain('[data-theme="dark"]');
            expect(css).toContain('[data-density="compact"]');
        });
    });
});
