import { describe, expect, it, vi } from "vitest";

vi.mock("@sugarcube-sh/core", async () => {
    const actual = await vi.importActual<any>("@sugarcube-sh/core");
    return {
        ...actual,
        loadInternalConfig: async () => ({
            config: {
                tokens: { source: [] },
                output: {
                    cssRoot: "src/styles",
                    variables: "src/styles/global",
                    utilities: "src/styles/utilities",
                    cube: "src/styles",
                },
                utilities: {},
            },
        }),
        loadAndResolveTokens: async () => ({
            trees: [],
            resolved: {} as any,
            errors: { load: [], flatten: [], validation: [], resolution: [] },
            modifiers: [],
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
        expect(flat.every((p) => p.name)).toBe(true);
    });
});
