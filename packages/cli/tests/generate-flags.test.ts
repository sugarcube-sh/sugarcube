import { fillDefaults } from "@sugarcube-sh/core";
import { describe, expect, it } from "vitest";

describe("Generate Command Flag Handling", () => {
    it("builds config from flags with all options", () => {
        const userConfig = {
            resolver: "./tokens.resolver.json",
            output: {
                cssRoot: "dist/styles",
                variables: "dist/variables",
                utilities: "dist/utilities",
            },
            transforms: {
                fluid: { min: 375, max: 1440 },
                colorFallbackStrategy: "polyfill" as const,
            },
        };

        const config = fillDefaults(userConfig);

        expect(config.resolver).toBe("./tokens.resolver.json");
        expect(config.output.cssRoot).toBe("dist/styles");
        expect(config.output.variables).toBe("dist/variables");
        expect(config.output.utilities).toBe("dist/utilities");
        expect(config.transforms.fluid.min).toBe(375);
        expect(config.transforms.fluid.max).toBe(1440);
        expect(config.transforms.colorFallbackStrategy).toBe("polyfill");
    });

    it("builds config with partial flags and defaults", () => {
        const userConfig = {
            resolver: "./tokens.resolver.json",
            output: {
                cssRoot: "src/css",
            },
        };

        const config = fillDefaults(userConfig);

        expect(config.resolver).toBe("./tokens.resolver.json");
        expect(config.output.cssRoot).toBe("src/css");
        expect(config.output.variables).toBe("src/css/global");
        expect(config.output.utilities).toBe("src/css/utilities");
        expect(config.transforms.fluid.min).toBe(320);
        expect(config.transforms.fluid.max).toBe(1200);
        expect(config.transforms.colorFallbackStrategy).toBe("native");
    });

    it("merges flags with existing config", () => {
        const existingConfig = fillDefaults({
            resolver: "./tokens.resolver.json",
            output: {
                cssRoot: "src/styles",
            },
        });

        const overrides = {
            transforms: {
                fluid: { min: existingConfig.transforms.fluid.min, max: 1600 },
                colorFallbackStrategy: existingConfig.transforms.colorFallbackStrategy,
            },
        };

        const mergedConfig = {
            ...existingConfig,
            transforms: overrides.transforms,
        };

        expect(mergedConfig.resolver).toBe("./tokens.resolver.json");
        expect(mergedConfig.output.cssRoot).toBe("src/styles");
        expect(mergedConfig.transforms.fluid.max).toBe(1600);
        expect(mergedConfig.transforms.fluid.min).toBe(320);
    });

    it("handles minimal config with just resolver", () => {
        const userConfig = {
            resolver: "./tokens.resolver.json",
        };

        const config = fillDefaults(userConfig);

        expect(config.resolver).toBe("./tokens.resolver.json");
        expect(config.output.cssRoot).toBe("src/styles");
        expect(config.output.variables).toBe("src/styles/global");
        expect(config.output.utilities).toBe("src/styles/utilities");
        expect(config.transforms.fluid).toEqual({ min: 320, max: 1200 });
    });
});
