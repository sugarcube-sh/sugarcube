import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config/validate-config.js";
import { DEFAULT_CONFIG } from "../src/constants/config.js";
import { generateCSSVariables } from "../src/generators/generate-css-variables.js";
import { loadAndResolveTokens } from "../src/pipelines/load-and-resolve.js";
import { processAndConvertTokens } from "../src/pipelines/process-and-convert.js";

const FIXTURES_DIR = resolve(__dirname, "__fixtures__/resolver");

async function generateFromResolver(
    resolverPath: string,
    config: ReturnType<typeof validateConfig>
) {
    const { trees, resolved, errors } = await loadAndResolveTokens({
        type: "resolver",
        resolverPath,
        config,
    });

    if (errors.load.length > 0) {
        return { trees, output: [], errors };
    }

    const convertedTokens = await processAndConvertTokens(
        trees,
        resolved,
        config,
        errors.validation
    );
    const output = await generateCSSVariables(convertedTokens, config);

    return { trees, output, errors };
}

const getCss = (result: Awaited<ReturnType<typeof generateFromResolver>>): string => {
    expect(result.output.length).toBeGreaterThanOrEqual(1);
    return result.output[0]?.css ?? "";
};

describe("Resolver Pipeline Integration", () => {
    describe("generateFromResolver", () => {
        it("generates CSS from simple resolver with inline tokens", async () => {
            const resolverPath = resolve(FIXTURES_DIR, "simple.resolver.json");
            const config = validateConfig({
                resolver: resolverPath,
            });

            const result = await generateFromResolver(resolverPath, config);

            expect(result.errors.load).toHaveLength(0);
            expect(result.errors.validation).toHaveLength(0);
            expect(result.output).toHaveLength(1);

            const css = getCss(result);
            expect(css).toContain(":root {");
            expect(css).toContain("--color-primary:");
            expect(css).toContain('[data-theme="dark"]');
        });

        it("generates CSS from resolver with file references", async () => {
            const resolverPath = resolve(FIXTURES_DIR, "with-file-refs.resolver.json");
            const config = validateConfig({
                resolver: resolverPath,
            });

            const result = await generateFromResolver(resolverPath, config);

            expect(result.errors.load).toHaveLength(0);
            expect(result.errors.validation).toHaveLength(0);
            expect(result.output).toHaveLength(1);

            const css = getCss(result);
            expect(css).toContain("--color-primary:");
            expect(css).toContain("--color-secondary:");
            expect(css).toContain('[data-theme="dark"]');
        });

        it("generates CSS from complex resolver with multiple sets and contexts", async () => {
            const resolverPath = resolve(FIXTURES_DIR, "complex.resolver.json");
            const config = validateConfig({
                resolver: resolverPath,
            });

            const result = await generateFromResolver(resolverPath, config);

            expect(result.errors.load).toHaveLength(0);
            expect(result.errors.validation).toHaveLength(0);
            expect(result.output).toHaveLength(1);

            const css = getCss(result);
            expect(css).toContain(":root {");
            expect(css).toContain("--color-brand-primary:");
            expect(css).toContain("--space-xs:");
            expect(css).toContain("--button-padding:");
            expect(css).toContain('[data-theme="dark"]');
            expect(css).toContain('[data-theme="ocean"]');
            expect(css).toContain('[data-theme="ocean-dark"]');
        });

        it("handles resolver without modifiers (sets only)", async () => {
            const resolverPath = resolve(FIXTURES_DIR, "no-modifiers.resolver.json");
            const config = validateConfig({
                resolver: resolverPath,
            });

            const result = await generateFromResolver(resolverPath, config);

            expect(result.errors.load).toHaveLength(0);
            expect(result.output).toHaveLength(1);

            const css = getCss(result);
            expect(css).toContain(":root {");
            expect(css).not.toContain("[data-theme=");
        });

        it("returns load errors for nonexistent resolver files", async () => {
            const resolverPath = "/nonexistent.resolver.json";
            const config = validateConfig({});

            const result = await generateFromResolver(resolverPath, config);

            expect(result.errors.load).toHaveLength(1);
            expect(result.output).toHaveLength(0);
        });

        it("returns load errors for invalid version", async () => {
            const resolverPath = resolve(FIXTURES_DIR, "invalid-version.resolver.json");
            const config = validateConfig({});

            const result = await generateFromResolver(resolverPath, config);

            expect(result.errors.load).toHaveLength(1);
        });
    });

    describe("config validation", () => {
        it("preserves resolver path", () => {
            const config = validateConfig({ resolver: "./tokens.resolver.json" });
            expect(config.resolver).toBe("./tokens.resolver.json");
        });

        it("fills default paths when none provided", () => {
            const config = validateConfig({});
            expect(config.variables.path).toContain(DEFAULT_CONFIG.variables.filename);
            expect(config.utilities.path).toContain(DEFAULT_CONFIG.utilities.filename);
        });
    });
});
