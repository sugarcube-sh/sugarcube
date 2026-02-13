import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config/validate-config.js";
import { generateCSSVariables } from "../src/generators/generate-css-variables.js";
import { loadAndResolveTokens } from "../src/pipelines/load-and-resolve.js";
import { processAndConvertTokens } from "../src/pipelines/process-and-convert.js";
import { processForLayeredCSS } from "../src/resolver/process-resolution-order.js";
import type { ResolverDocument, Source } from "../src/types/resolver.js";
import type { TokenGroup } from "../src/types/dtcg.js";

const FIXTURES_DIR = resolve(__dirname, "__fixtures__/resolver");

async function generateFromResolver(
    resolverPath: string,
    config: ReturnType<typeof validateConfig>
) {
    const { trees, resolved, modifiers, errors } = await loadAndResolveTokens({
        type: "resolver",
        resolverPath,
        config,
    });

    if (errors.load.length > 0) {
        return { trees, modifiers, output: [], errors };
    }

    const convertedTokens = await processAndConvertTokens(
        trees,
        resolved,
        config,
        errors.validation
    );
    const output = await generateCSSVariables(convertedTokens, config, modifiers);

    return { trees, modifiers, output, errors };
}

const getCss = (result: Awaited<ReturnType<typeof generateFromResolver>>): string => {
    expect(result.output.length).toBeGreaterThanOrEqual(1);
    return result.output[0]?.css ?? "";
};

const getCssBlock = (css: string, selectorPattern: string): string | undefined => {
    const blocks = css.split(/(?=\[data-|:root)/);
    return blocks.find((b) => b.includes(selectorPattern));
};

const buildLayeredDoc = {
    simple: (
        baseTokens: TokenGroup,
        modifier: {
            name: string;
            default: string;
            contexts: Record<string, TokenGroup[]>;
        }
    ): ResolverDocument => ({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [baseTokens] },
            {
                type: "modifier",
                name: modifier.name,
                default: modifier.default,
                contexts: Object.fromEntries(
                    Object.entries(modifier.contexts).map(([k, v]) => [k, v as Source[]])
                ),
            },
        ],
    }),

    withModifiers: (
        baseTokens: TokenGroup,
        modifiers: Array<{
            name: string;
            default: string;
            contexts: Record<string, TokenGroup[]>;
        }>
    ): ResolverDocument => ({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [baseTokens] },
            ...modifiers.map((m) => ({
                type: "modifier" as const,
                name: m.name,
                default: m.default,
                contexts: Object.fromEntries(
                    Object.entries(m.contexts).map(([k, v]) => [k, v as Source[]])
                ),
            })),
        ],
    }),
};

describe("Resolver Pipeline Integration", () => {
    describe("generateFromResolver", () => {
        it("generates CSS from simple resolver with inline tokens", async () => {
            const resolverPath = resolve(FIXTURES_DIR, "simple.resolver.json");
            const config = validateConfig({
                resolver: resolverPath,
                output: { cssRoot: "dist/css" },
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
                output: { cssRoot: "dist/css" },
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
                output: { cssRoot: "dist/css" },
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
                output: { cssRoot: "dist/css" },
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
            const config = validateConfig({ output: { cssRoot: "dist/css" } });

            const result = await generateFromResolver(resolverPath, config);

            expect(result.errors.load).toHaveLength(1);
            expect(result.output).toHaveLength(0);
        });

        it("returns load errors for invalid version", async () => {
            const resolverPath = resolve(FIXTURES_DIR, "invalid-version.resolver.json");
            const config = validateConfig({ output: { cssRoot: "dist/css" } });

            const result = await generateFromResolver(resolverPath, config);

            expect(result.errors.load).toHaveLength(1);
        });
    });

    describe("config validation", () => {
        it("preserves resolver path", () => {
            const config = validateConfig({ resolver: "./tokens.resolver.json" });
            expect(config.resolver).toBe("./tokens.resolver.json");
        });

        it("allows config with only output", () => {
            const config = validateConfig({ output: { cssRoot: "dist/css" } });
            expect(config.output.cssRoot).toBe("dist/css");
        });

        it("fills default themeAttribute", () => {
            const config = validateConfig({ resolver: "./tokens.resolver.json" });
            expect(config.output.themeAttribute).toBe("data-theme");
        });
    });
});

describe("processForLayeredCSS", () => {
    it("processes resolver with single modifier", async () => {
        const doc = buildLayeredDoc.simple(
            { color: { primary: { $type: "color", $value: "#3b82f6" } } } as TokenGroup,
            {
                name: "theme",
                default: "light",
                contexts: {
                    light: [],
                    dark: [
                        { color: { primary: { $type: "color", $value: "#60a5fa" } } } as TokenGroup,
                    ],
                },
            }
        );

        const result = await processForLayeredCSS(doc, process.cwd());

        expect(result.errors).toHaveLength(0);
        expect(result.base).toBeDefined();
        expect(result.modifiers).toHaveLength(1);
        expect(result.modifiers[0]?.name).toBe("theme");
        expect(result.modifiers[0]?.defaultContext).toBe("light");
        expect(result.modifiers[0]?.contexts.has("dark")).toBe(true);
    });

    it("processes resolver with multiple orthogonal modifiers", async () => {
        const doc = buildLayeredDoc.withModifiers(
            {
                color: { primary: { $type: "color", $value: "#3b82f6" } },
                spacing: { md: { $type: "dimension", $value: { value: 16, unit: "px" } } },
            } as TokenGroup,
            [
                {
                    name: "theme",
                    default: "light",
                    contexts: {
                        light: [],
                        dark: [
                            {
                                color: { primary: { $type: "color", $value: "#60a5fa" } },
                            } as TokenGroup,
                        ],
                    },
                },
                {
                    name: "density",
                    default: "normal",
                    contexts: {
                        normal: [],
                        compact: [
                            {
                                spacing: {
                                    md: { $type: "dimension", $value: { value: 8, unit: "px" } },
                                },
                            } as TokenGroup,
                        ],
                    },
                },
            ]
        );

        const result = await processForLayeredCSS(doc, process.cwd());

        expect(result.errors).toHaveLength(0);
        expect(result.modifiers).toHaveLength(2);

        const themeMod = result.modifiers.find((m) => m.name === "theme");
        expect(themeMod?.defaultContext).toBe("light");
        expect(themeMod?.contexts.has("dark")).toBe(true);

        const densityMod = result.modifiers.find((m) => m.name === "density");
        expect(densityMod?.defaultContext).toBe("normal");
        expect(densityMod?.contexts.has("compact")).toBe(true);
    });

    it("includes base tokens from sets", async () => {
        const doc = buildLayeredDoc.simple(
            { color: { primary: { $type: "color", $value: "#3b82f6" } } } as TokenGroup,
            { name: "theme", default: "light", contexts: { light: [], dark: [] } }
        );

        const result = await processForLayeredCSS(doc, process.cwd());

        expect(result.base).toHaveProperty("color");
    });
});

describe("Layered CSS Generation", () => {
    it("outputs base tokens to :root and context tokens to attribute selectors", async () => {
        const resolverPath = resolve(FIXTURES_DIR, "simple.resolver.json");
        const config = validateConfig({
            resolver: resolverPath,
            output: { cssRoot: "dist/css" },
        });

        const result = await generateFromResolver(resolverPath, config);
        const css = getCss(result);

        expect(css).toContain(":root {");
        expect(css).toContain("--color-primary:");
        expect(css).toContain('[data-theme="dark"]');
    });

    it("generates independent selectors for multiple orthogonal modifiers", async () => {
        const resolverPath = resolve(FIXTURES_DIR, "multiple-modifiers.resolver.json");
        const config = validateConfig({
            resolver: resolverPath,
            output: { cssRoot: "dist/css" },
        });

        const result = await generateFromResolver(resolverPath, config);
        const css = getCss(result);

        expect(css).toContain(":root {");
        expect(css).toContain("--color-primary:");
        expect(css).toContain("--spacing-md:");
        expect(css).toContain('[data-theme="dark"]');
        expect(css).toContain('[data-density="compact"]');
        expect(css).not.toContain('[data-theme="dark"][data-density="compact"]');
    });

    it("auto-derives attribute names from modifier names", async () => {
        const resolverPath = resolve(FIXTURES_DIR, "multiple-modifiers.resolver.json");
        const config = validateConfig({
            resolver: resolverPath,
            output: { cssRoot: "dist/css" },
        });

        const result = await generateFromResolver(resolverPath, config);
        const css = getCss(result);

        expect(css).toContain("data-theme=");
        expect(css).toContain("data-density=");
    });

    it("scopes context tokens to only those defined in that context", async () => {
        const resolverPath = resolve(FIXTURES_DIR, "multiple-modifiers.resolver.json");
        const config = validateConfig({
            resolver: resolverPath,
            output: { cssRoot: "dist/css" },
        });

        const result = await generateFromResolver(resolverPath, config);
        const css = getCss(result);

        const darkBlock = getCssBlock(css, '[data-theme="dark"]');
        expect(darkBlock).toBeDefined();
        expect(darkBlock).toContain("--color-");
        expect(darkBlock).not.toContain("--spacing-");

        const compactBlock = getCssBlock(css, '[data-density="compact"]');
        expect(compactBlock).toBeDefined();
        expect(compactBlock).toContain("--spacing-");
        expect(compactBlock).not.toContain("--color-");
    });
});
