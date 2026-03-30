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

import sugarcube from "../src/index.js";

describe("vite-plugin-sugarcube", () => {
    it("should return array of plugins with correct structure", async () => {
        const plugins = await sugarcube();
        expect(Array.isArray(plugins)).toBe(true);
        const flat = plugins.flat();
        expect(flat.every((p: any) => p.name)).toBe(true);
    });
});
