import { describe, expect, it, vi } from "vitest";

const { loadTokens } = vi.hoisted(() => ({ loadTokens: vi.fn() }));

vi.mock("@sugarcube-sh/core", async () => {
    const actual = await vi.importActual<any>("@sugarcube-sh/core");
    return {
        ...actual,
        loadInternalConfig: async () => ({
            config: {
                resolver: "tokens/tokens.resolver.json",
                variables: {
                    path: "src/styles/tokens.css",
                    transforms: {
                        fluid: { min: 320, max: 1200 },
                        colorFallbackStrategy: "native",
                    },
                },
                utilities: {
                    path: "src/styles/utilities.css",
                    classes: {},
                },
                cube: "src/styles",
            },
        }),
        loadTokens,
        resolveTokens: () => ({
            trees: [],
            resolved: {} as any,
            errors: { expandTree: [], flatten: [], validation: [], resolution: [] },
            warnings: [],
        }),
        groupByContext: () => ({ default: {} }),
        assignCSSNames: () => ({ default: { default: {} } }),
        generateCSSVariables: async () => [{ css: "" }],
        convertConfigToUnoRules: () => [],
    };
});

import sugarcube, { extractTokenDirs } from "../src/index.js";

const loaded = {
    trees: [],
    errors: [],
    permutations: [{ name: "default", modifiers: {} }],
    sources: {
        files: { "/tokens/color.json": "{}" },
        order: [{ context: "default", sources: [{ file: "/tokens/color.json" }] }],
    },
    defaultContext: "default",
};

async function context() {
    const plugins = await sugarcube();
    const api = plugins.flat().find((p: any) => p.name === "sugarcube:api");
    return api.api.getContext();
}

describe("vite-plugin-sugarcube", () => {
    it("should return array of plugins with correct structure", async () => {
        loadTokens.mockResolvedValue(loaded);
        const plugins = await sugarcube();
        expect(Array.isArray(plugins)).toBe(true);
        const flat = plugins.flat();
        expect(flat.every((p: any) => p.name)).toBe(true);
    });

    it("reports sources, permutations and defaultContext from loadTokens", async () => {
        loadTokens.mockResolvedValue(loaded);
        const ctx = await context();
        expect(ctx.sources).toBe(loaded.sources);
        expect(ctx.permutations).toBe(loaded.permutations);
        expect(ctx.defaultContext).toBe("default");
    });

    it("reports null sources and defaultContext when loadTokens has none", async () => {
        loadTokens.mockResolvedValue({ trees: [], errors: [], permutations: [] });
        const ctx = await context();
        expect(ctx.sources).toBeNull();
        expect(ctx.defaultContext).toBeNull();
        expect(ctx.permutations).toEqual([]);
    });
});

describe("extractTokenDirs", () => {
    it("should return empty array when no resolver is set", () => {
        expect(extractTokenDirs({ resolver: undefined })).toEqual([]);
    });

    it("should return absolute directory for relative resolver path", () => {
        const dirs = extractTokenDirs({ resolver: "tokens/tokens.resolver.json" });
        expect(dirs).toHaveLength(1);
        expect(dirs[0]).toMatch(/\/tokens$/);
        expect(dirs[0]).not.toContain("./");
    });

    it("should return absolute directory for ./ prefixed resolver path", () => {
        const dirs = extractTokenDirs({ resolver: "./tokens/tokens.resolver.json" });
        expect(dirs).toHaveLength(1);
        expect(dirs[0]).toMatch(/\/tokens$/);
        expect(dirs[0]).not.toContain("./");
    });

    it("should produce consistent paths regardless of ./ prefix", () => {
        const withDot = extractTokenDirs({ resolver: "./tokens/tokens.resolver.json" });
        const withoutDot = extractTokenDirs({ resolver: "tokens/tokens.resolver.json" });
        expect(withDot).toEqual(withoutDot);
    });

    it("should handle resolver in project root", () => {
        const dirs = extractTokenDirs({ resolver: "tokens.resolver.json" });
        expect(dirs).toHaveLength(1);
        expect(dirs[0]).toBe(process.cwd());
    });
});
