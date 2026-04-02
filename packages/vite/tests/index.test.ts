import { describe, expect, it, vi } from "vitest";

vi.mock("@sugarcube-sh/core", async () => {
    const actual = await vi.importActual<any>("@sugarcube-sh/core");
    return {
        ...actual,
        loadInternalConfig: async () => ({
            config: {
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
        loadAndResolveTokens: async () => ({
            trees: [],
            resolved: {} as any,
            errors: { load: [], flatten: [], validation: [], resolution: [] },
            modifiers: [],
            warnings: [],
        }),
        processAndConvertTokens: async () => ({ default: { default: {} } }),
        generateCSSVariables: async () => [{ css: "" }],
        convertConfigToUnoRules: () => [],
    };
});

import sugarcube, { extractTokenDirs } from "../src/index.js";

describe("vite-plugin-sugarcube", () => {
    it("should return array of plugins with correct structure", async () => {
        const plugins = await sugarcube();
        expect(Array.isArray(plugins)).toBe(true);
        const flat = plugins.flat();
        expect(flat.every((p: any) => p.name)).toBe(true);
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
