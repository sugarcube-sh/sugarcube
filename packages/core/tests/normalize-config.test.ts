import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/node/config/normalize.js";
import { fillDefaults } from "../src/node/config/normalize.js";
import { DEFAULT_CONFIG } from "../src/shared/constants/config.js";
import type { SugarcubeConfig } from "../src/types/config.js";

const minimalConfig = (overrides: Partial<SugarcubeConfig> = {}): SugarcubeConfig => ({
    resolver: "./tokens.resolver.json",
    ...overrides,
});

describe("fillDefaults", () => {
    describe("variables defaults", () => {
        it("provides default variables path when omitted", () => {
            const result = fillDefaults(minimalConfig());

            expect(result.variables.path).toContain(DEFAULT_CONFIG.variables.filename);
            expect(result.variables.transforms.fluid.min).toBe(
                DEFAULT_CONFIG.variables.transforms.fluid.min
            );
            expect(result.variables.transforms.fluid.max).toBe(
                DEFAULT_CONFIG.variables.transforms.fluid.max
            );
            expect(result.variables.transforms.colorFallbackStrategy).toBe(
                DEFAULT_CONFIG.variables.transforms.colorFallbackStrategy
            );
        });

        it("preserves user-specified variables path", () => {
            const result = fillDefaults(
                minimalConfig({
                    variables: { path: "custom/tokens.css" },
                })
            );

            expect(result.variables.path).toBe("custom/tokens.css");
        });

        it("preserves user-specified variables layer", () => {
            const result = fillDefaults(
                minimalConfig({
                    variables: { path: "tokens.css", layer: "tokens" },
                })
            );

            expect(result.variables.layer).toBe("tokens");
        });

        it("preserves user-specified fluid config", () => {
            const result = fillDefaults(
                minimalConfig({
                    variables: {
                        transforms: { fluid: { min: 400, max: 1400 } },
                    },
                })
            );

            expect(result.variables.transforms.fluid).toEqual({ min: 400, max: 1400 });
            expect(result.variables.transforms.colorFallbackStrategy).toBe("native");
        });

        it("preserves user-specified colorFallbackStrategy", () => {
            const result = fillDefaults(
                minimalConfig({
                    variables: {
                        transforms: { colorFallbackStrategy: "polyfill" },
                    },
                })
            );

            expect(result.variables.transforms.colorFallbackStrategy).toBe("polyfill");
        });

        it("preserves user-specified permutations", () => {
            const permutations = [
                {
                    input: { theme: "dark" },
                    selector: ":root",
                    atRule: "@media (prefers-color-scheme: dark)",
                },
            ];

            const result = fillDefaults(
                minimalConfig({
                    variables: { permutations },
                })
            );

            expect(result.variables.permutations).toEqual(permutations);
        });
    });

    describe("utilities defaults", () => {
        it("provides default utilities path when omitted", () => {
            const result = fillDefaults(minimalConfig());

            expect(result.utilities.path).toContain(DEFAULT_CONFIG.utilities.filename);
        });

        it("preserves user-specified utilities path", () => {
            const result = fillDefaults(
                minimalConfig({
                    utilities: { path: "custom/utilities.css" },
                })
            );

            expect(result.utilities.path).toBe("custom/utilities.css");
        });

        it("preserves user-specified utilities layer", () => {
            const result = fillDefaults(
                minimalConfig({
                    utilities: { path: "utilities.css", layer: "utilities" },
                })
            );

            expect(result.utilities.layer).toBe("utilities");
        });

        it("preserves user-specified utility classes config", () => {
            const classes = {
                color: { source: "color.*", prefix: "text" },
                padding: { source: "space.*", prefix: "p", directions: ["all" as const] },
            };

            const result = fillDefaults(minimalConfig({ utilities: { classes } }));

            expect(result.utilities.classes).toEqual(classes);
        });
    });

    describe("top-level fields", () => {
        it("preserves resolver path unchanged", () => {
            const result = fillDefaults(
                minimalConfig({
                    resolver: "./custom/path.resolver.json",
                })
            );

            expect(result.resolver).toBe("./custom/path.resolver.json");
        });

        it("preserves cube path unchanged", () => {
            const result = fillDefaults(
                minimalConfig({
                    cube: "src/styles/cube",
                })
            );

            expect(result.cube).toBe("src/styles/cube");
        });

        it("preserves components path unchanged", () => {
            const result = fillDefaults(
                minimalConfig({
                    components: "lib/ui",
                })
            );

            expect(result.components).toBe("lib/ui");
        });
    });
});

describe("validateConfig — variables.variableName", () => {
    it("accepts a function and preserves reference identity", () => {
        const userFn = (path: string) => `custom-${path}`;
        const result = validateConfig({
            resolver: "./tokens.resolver.json",
            variables: { variableName: userFn },
        });

        // Reference identity matters — z.function() wraps and would break this.
        expect(result.variables.variableName).toBe(userFn);
        expect(result.variables.variableName?.("color.primary")).toBe("custom-color.primary");
    });

    it("leaves variableName undefined when omitted", () => {
        const result = validateConfig({
            resolver: "./tokens.resolver.json",
        });

        expect(result.variables.variableName).toBeUndefined();
    });

    it.each([
        ["string", "not a function"],
        ["number", 42],
        ["object", {}],
        ["array", [1, 2, 3]],
        ["null", null],
    ])("rejects %s", (_label, value) => {
        expect(() =>
            validateConfig({
                resolver: "./tokens.resolver.json",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                variables: { variableName: value as any },
            })
        ).toThrow(/variableName must be a function/);
    });
});
