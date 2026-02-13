import { describe, expect, it } from "vitest";
import { fillDefaults } from "../src/config/normalize-config.js";
import type { SugarcubeConfig } from "../src/types/config.js";

const minimalConfig = (overrides: Partial<SugarcubeConfig> = {}): SugarcubeConfig => ({
    resolver: "./tokens.resolver.json",
    ...overrides,
});

describe("fillDefaults", () => {
    describe("output defaults", () => {
        it("provides default output paths when output is omitted", () => {
            const result = fillDefaults(minimalConfig());

            expect(result.output.cssRoot).toBe("src/styles");
            expect(result.output.variables).toBe("src/styles/global");
            expect(result.output.variablesFilename).toBe("tokens.variables.gen.css");
            expect(result.output.utilities).toBe("src/styles/utilities");
            expect(result.output.utilitiesFilename).toBe("utilities.gen.css");
            expect(result.output.cube).toBe("src/styles");
            expect(result.output.components).toBe("src/components/ui");
            expect(result.output.themeAttribute).toBe("data-theme");
        });

        it("preserves user-specified output.cssRoot", () => {
            const result = fillDefaults(
                minimalConfig({
                    output: { cssRoot: "custom/styles" },
                })
            );

            expect(result.output.cssRoot).toBe("custom/styles");
            expect(result.output.variables).toBe("custom/styles/global");
            expect(result.output.utilities).toBe("custom/styles/utilities");
            expect(result.output.cube).toBe("custom/styles");
            expect(result.output.components).toBe("src/components/ui");
            expect(result.output.themeAttribute).toBe("data-theme");
        });

        it("preserves user-specified output.variables", () => {
            const result = fillDefaults(
                minimalConfig({
                    output: { cssRoot: "src/styles", variables: "src/tokens" },
                })
            );

            expect(result.output.cssRoot).toBe("src/styles");
            expect(result.output.variables).toBe("src/tokens");
            expect(result.output.utilities).toBe("src/styles/utilities");
            expect(result.output.cube).toBe("src/styles");
        });

        it("preserves user-specified output.utilities", () => {
            const result = fillDefaults(
                minimalConfig({
                    output: { cssRoot: "src/styles", utilities: "src/utils" },
                })
            );

            expect(result.output.cssRoot).toBe("src/styles");
            expect(result.output.variables).toBe("src/styles/global");
            expect(result.output.utilities).toBe("src/utils");
            expect(result.output.cube).toBe("src/styles");
        });

        it("preserves user-specified output.cube", () => {
            const result = fillDefaults(
                minimalConfig({
                    output: { cssRoot: "src/styles", cube: "src/css/cube" },
                })
            );

            expect(result.output.cssRoot).toBe("src/styles");
            expect(result.output.variables).toBe("src/styles/global");
            expect(result.output.utilities).toBe("src/styles/utilities");
            expect(result.output.cube).toBe("src/css/cube");
        });

        it("preserves user-specified output.components", () => {
            const result = fillDefaults(
                minimalConfig({
                    output: { components: "lib/ui" },
                })
            );

            expect(result.output.components).toBe("lib/ui");
            expect(result.output.cssRoot).toBe("src/styles");
        });

        it("preserves user-specified output.themeAttribute", () => {
            const result = fillDefaults(
                minimalConfig({
                    output: { themeAttribute: "data-color-scheme" },
                })
            );

            expect(result.output.themeAttribute).toBe("data-color-scheme");
        });

        it("preserves user-specified output.defaultContext", () => {
            const result = fillDefaults(
                minimalConfig({
                    output: { defaultContext: "light" },
                })
            );

            expect(result.output.defaultContext).toBe("light");
        });

        it("preserves user-specified output.variablesFilename", () => {
            const result = fillDefaults(
                minimalConfig({
                    output: { variablesFilename: "custom-vars.css" },
                })
            );

            expect(result.output.variablesFilename).toBe("custom-vars.css");
        });

        it("preserves user-specified output.utilitiesFilename", () => {
            const result = fillDefaults(
                minimalConfig({
                    output: { utilitiesFilename: "custom-utils.css" },
                })
            );

            expect(result.output.utilitiesFilename).toBe("custom-utils.css");
        });
    });

    describe("transforms defaults", () => {
        it("provides default fluid config when transforms is omitted", () => {
            const result = fillDefaults(minimalConfig());

            expect(result.transforms.fluid).toEqual({ min: 320, max: 1200 });
            expect(result.transforms.colorFallbackStrategy).toBe("native");
        });

        it("preserves user-specified fluid config", () => {
            const result = fillDefaults(
                minimalConfig({
                    transforms: { fluid: { min: 400, max: 1400 } },
                })
            );

            expect(result.transforms.fluid).toEqual({ min: 400, max: 1400 });
            expect(result.transforms.colorFallbackStrategy).toBe("native");
        });

        it("preserves user-specified colorFallbackStrategy", () => {
            const result = fillDefaults(
                minimalConfig({
                    transforms: { colorFallbackStrategy: "polyfill" },
                })
            );

            expect(result.transforms.colorFallbackStrategy).toBe("polyfill");
        });
    });

    describe("passthrough fields", () => {
        it("preserves resolver path unchanged", () => {
            const result = fillDefaults(
                minimalConfig({
                    resolver: "./custom/path.resolver.json",
                })
            );

            expect(result.resolver).toBe("./custom/path.resolver.json");
        });

        it("preserves utilities config unchanged", () => {
            const utilities = {
                color: { source: "color.*", prefix: "text" },
                padding: { source: "space.*", prefix: "p", directions: ["all" as const] },
            };

            const result = fillDefaults(minimalConfig({ utilities }));

            expect(result.utilities).toEqual(utilities);
        });
    });
});
