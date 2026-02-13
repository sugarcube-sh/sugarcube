import { describe, expect, it } from "vitest";
import { buildSugarcubeConfig } from "../src/config/builder.js";
import type { InitOptions } from "../src/types/index.js";

describe("Config Builder", () => {
    describe("buildSugarcubeConfig", () => {
        it("should return empty config when no flags are provided", async () => {
            const options: InitOptions = {
                tokensDir: undefined,
                stylesDir: undefined,
                variablesDir: undefined,
                utilitiesDir: undefined,
                fluidMin: undefined,
                fluidMax: undefined,
                colorFallback: undefined,
                skipDeps: false,
                kit: "fluid",
            };

            const result = await buildSugarcubeConfig(options);

            expect(result).toEqual({});
        });

        it("should only include stylesDir when provided", async () => {
            const options: InitOptions = {
                tokensDir: undefined,
                stylesDir: "custom/styles",
                variablesDir: undefined,
                utilitiesDir: undefined,
                fluidMin: undefined,
                fluidMax: undefined,
                colorFallback: undefined,
                skipDeps: false,
                kit: "fluid",
            };

            const result = await buildSugarcubeConfig(options);

            expect(result).toEqual({
                output: {
                    cssRoot: "custom/styles",
                },
            });
        });

        it("should include variablesDir and utilitiesDir when provided", async () => {
            const options: InitOptions = {
                tokensDir: undefined,
                stylesDir: undefined,
                variablesDir: "custom/vars",
                utilitiesDir: "custom/utils",
                fluidMin: undefined,
                fluidMax: undefined,
                colorFallback: undefined,
                skipDeps: false,
                kit: "fluid",
            };

            const result = await buildSugarcubeConfig(options);

            expect(result).toEqual({
                output: {
                    variables: "custom/vars",
                    utilities: "custom/utils",
                },
            });
        });

        it("should include fluid transform when both min and max are provided", async () => {
            const options: InitOptions = {
                tokensDir: undefined,
                stylesDir: undefined,
                variablesDir: undefined,
                utilitiesDir: undefined,
                fluidMin: "375",
                fluidMax: "1920",
                colorFallback: undefined,
                skipDeps: false,
                kit: "fluid",
            };

            const result = await buildSugarcubeConfig(options);

            expect(result).toEqual({
                transforms: {
                    fluid: {
                        min: 375,
                        max: 1920,
                    },
                },
            });
        });

        it("should include colorFallback when provided", async () => {
            const options: InitOptions = {
                tokensDir: undefined,
                stylesDir: undefined,
                variablesDir: undefined,
                utilitiesDir: undefined,
                fluidMin: undefined,
                fluidMax: undefined,
                colorFallback: "polyfill",
                skipDeps: false,
                kit: "fluid",
            };

            const result = await buildSugarcubeConfig(options);

            expect(result).toEqual({
                transforms: {
                    colorFallbackStrategy: "polyfill",
                },
            });
        });

        it("should combine multiple customizations", async () => {
            const options: InitOptions = {
                tokensDir: undefined,
                stylesDir: "public/css",
                variablesDir: "vars",
                utilitiesDir: "utils",
                fluidMin: "320",
                fluidMax: "1440",
                colorFallback: "polyfill",
                skipDeps: false,
                kit: "fluid",
            };

            const result = await buildSugarcubeConfig(options);

            expect(result).toEqual({
                output: {
                    cssRoot: "public/css",
                    variables: "vars",
                    utilities: "utils",
                },
                transforms: {
                    fluid: {
                        min: 320,
                        max: 1440,
                    },
                    colorFallbackStrategy: "polyfill",
                },
            });
        });

        it("should never include resolver in config", async () => {
            const options: InitOptions = {
                tokensDir: "src/tokens",
                stylesDir: "src/styles",
                variablesDir: undefined,
                utilitiesDir: undefined,
                fluidMin: undefined,
                fluidMax: undefined,
                colorFallback: undefined,
                skipDeps: false,
                kit: "fluid",
            };

            const result = await buildSugarcubeConfig(options);

            expect(result.resolver).toBeUndefined();
            expect(result).toEqual({
                output: {
                    cssRoot: "src/styles",
                },
            });
        });
    });
});
