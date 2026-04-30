import { describe, expect, it } from "vitest";
import { renderDimension } from "../../../src/shared/renderers/css/dimension.js";
import type { CSSRenderOptions } from "../../../src/types/render.js";
import type { TokenValue } from "../../../src/types/tokens.js";

describe("renderDimension", () => {
    const defaultOptions: CSSRenderOptions = {
        path: "some.token.path",
        fluidConfig: {
            min: 320,
            max: 1200,
        },
        colorFallbackStrategy: "native",
    };

    it("should handle reference values", () => {
        const reference = "{dimension.spacing.1}";
        const result = renderDimension(reference, defaultOptions);
        expect(result).toEqual({ value: reference });
    });

    it("should convert pixel values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 16,
            unit: "px",
        };
        const result = renderDimension(dimension, defaultOptions);
        expect(result).toEqual({ value: "16px" });
    });

    it("should convert rem values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 1.5,
            unit: "rem",
        };
        const result = renderDimension(dimension, defaultOptions);
        expect(result).toEqual({ value: "1.5rem" });
    });

    it("should handle decimal values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 0.75,
            unit: "rem",
        };
        const result = renderDimension(dimension, defaultOptions);
        expect(result).toEqual({ value: "0.75rem" });
    });

    it("should handle zero values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 0,
            unit: "px",
        };
        const result = renderDimension(dimension, defaultOptions);
        expect(result).toEqual({ value: "0px" });
    });

    describe("fluid extension", () => {
        it("should convert dimension with fluid extension to clamp()", () => {
            const dimension: TokenValue<"dimension"> = {
                value: 24,
                unit: "px",
            };
            const options: CSSRenderOptions = {
                ...defaultOptions,
                extensions: {
                    "sh.sugarcube": {
                        fluid: {
                            min: { value: 16, unit: "px" },
                            max: { value: 24, unit: "px" },
                        },
                    },
                },
            };
            const result = renderDimension(dimension, options);
            expect(result.value).toMatch(/^clamp\(1rem, .* \+ .*vw, 1.5rem\)$/);
        });

        it("should convert fluid extension with rem values", () => {
            const dimension: TokenValue<"dimension"> = {
                value: 1.5,
                unit: "rem",
            };
            const options: CSSRenderOptions = {
                ...defaultOptions,
                extensions: {
                    "sh.sugarcube": {
                        fluid: {
                            min: { value: 1, unit: "rem" },
                            max: { value: 1.5, unit: "rem" },
                        },
                    },
                },
            };
            const result = renderDimension(dimension, options);
            expect(result.value).toMatch(/^clamp\(1rem, .* \+ .*vw, 1.5rem\)$/);
        });

        it("should return static value when min and max are the same", () => {
            const dimension: TokenValue<"dimension"> = {
                value: 16,
                unit: "px",
            };
            const options: CSSRenderOptions = {
                ...defaultOptions,
                extensions: {
                    "sh.sugarcube": {
                        fluid: {
                            min: { value: 16, unit: "px" },
                            max: { value: 16, unit: "px" },
                        },
                    },
                },
            };
            const result = renderDimension(dimension, options);
            expect(result).toEqual({ value: "1rem" });
        });

        it("uses viewport from the fluid extension when present (overrides global config)", () => {
            const dimension: TokenValue<"dimension"> = { value: 24, unit: "px" };
            const options: CSSRenderOptions = {
                ...defaultOptions,
                fluidConfig: { min: 320, max: 1200 }, // global default
                extensions: {
                    "sh.sugarcube": {
                        fluid: {
                            min: { value: 16, unit: "px" },
                            max: { value: 24, unit: "px" },
                            viewport: { min: 480, max: 1920 }, // per-token override
                        },
                    },
                },
            };
            const result = renderDimension(dimension, options);

            // Slope is (1.5 - 1) / (1920/16 - 480/16) = 0.5 / 90 ≈ 0.00556
            // Intersection = -30 * 0.00556 + 1 ≈ 0.83
            // The vw component would be different if the global config (320/1200) were used.
            expect(result.value).toMatch(/^clamp\(1rem, 0.83rem \+ 0.56vw, 1.5rem\)$/);
        });

        it("falls back to global fluidConfig when extension has no viewport", () => {
            const dimension: TokenValue<"dimension"> = { value: 24, unit: "px" };
            const options: CSSRenderOptions = {
                ...defaultOptions,
                fluidConfig: { min: 320, max: 1200 },
                extensions: {
                    "sh.sugarcube": {
                        fluid: {
                            min: { value: 16, unit: "px" },
                            max: { value: 24, unit: "px" },
                        },
                    },
                },
            };
            const result = renderDimension(dimension, options);

            // Same min/max as the override test but different viewport;
            // expect the historical (pre-Phase-2) output.
            expect(result.value).toMatch(/^clamp\(1rem, .* \+ .*vw, 1.5rem\)$/);
        });

        it("should generate mathematically correct clamp values", () => {
            const dimension: TokenValue<"dimension"> = {
                value: 32,
                unit: "px",
            };
            const options: CSSRenderOptions = {
                ...defaultOptions,
                extensions: {
                    "sh.sugarcube": {
                        fluid: {
                            min: { value: 16, unit: "px" },
                            max: { value: 32, unit: "px" },
                        },
                    },
                },
            };
            const result = renderDimension(dimension, options);
            const [min, calc, max] = String(result.value)
                .replace("clamp(", "")
                .replace(")", "")
                .split(",")
                .map((s: string) => s.trim());

            expect(min).toBe("1rem");
            expect(calc).toMatch(/^-?\d+\.?\d*rem \+ \d+\.?\d*vw$/);
            expect(max).toBe("2rem");
        });
    });
});
