import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/node/config/normalize.js";
import { loadTokens } from "../src/node/load-tokens.js";
import { DEFAULT_CONFIG } from "../src/shared/constants/config.js";
import { generateCSSVariables } from "../src/shared/generate-css-variables.js";
import { assignCSSNames } from "../src/shared/pipeline/assign-css-names.js";
import { groupByContext } from "../src/shared/pipeline/group-by-context.js";
import { resolveTokens } from "../src/shared/resolve-tokens.js";
import type { ResolvedToken } from "../src/types/resolve.js";

const FIXTURES_DIR = resolve(__dirname, "__fixtures__/resolver");

async function generateFromResolver(
    resolverPath: string,
    config: ReturnType<typeof validateConfig>
) {
    const loaded = await loadTokens({
        type: "resolver",
        resolverPath,
        config,
    });

    const resolved = resolveTokens(loaded.trees);
    const errors = { load: loaded.errors, ...resolved.errors };

    if (errors.load.length > 0) {
        return { trees: resolved.trees, output: [], resolved: resolved.resolved, errors };
    }

    const converted = assignCSSNames(
        groupByContext(resolved.trees, resolved.resolved),
        config,
        errors.validation
    );
    const output = await generateCSSVariables(converted, config);

    return { trees: resolved.trees, output, resolved: resolved.resolved, errors };
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

    describe("source file attribution", () => {
        it("tokens loaded via resolver have sourcePath pointing to the actual token file, not the resolver", async () => {
            const resolverPath = resolve(FIXTURES_DIR, "with-file-refs.resolver.json");
            const config = validateConfig({
                resolver: resolverPath,
            });

            const { resolved, errors } = await generateFromResolver(resolverPath, config);

            expect(errors.load).toHaveLength(0);

            const colorsFile = relative(process.cwd(), resolve(FIXTURES_DIR, "tokens/colors.json"));
            const spacingFile = relative(
                process.cwd(),
                resolve(FIXTURES_DIR, "tokens/spacing.json")
            );

            // Find a color token and a spacing token in the resolved output
            const colorToken = resolved["perm:0.color.primary"] as ResolvedToken;
            const spaceToken = resolved["perm:0.space.xs"] as ResolvedToken;

            expect(colorToken).toBeDefined();
            expect(spaceToken).toBeDefined();

            // sourcePath should point to the actual token file, not the resolver
            expect(colorToken.$source.sourcePath).toBe(colorsFile);
            expect(spaceToken.$source.sourcePath).toBe(spacingFile);

            // Crucially, they should NOT point to the resolver file
            expect(colorToken.$source.sourcePath).not.toContain("resolver.json");
            expect(spaceToken.$source.sourcePath).not.toContain("resolver.json");
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
