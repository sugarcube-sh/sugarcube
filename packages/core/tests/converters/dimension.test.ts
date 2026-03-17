import { describe, expect, it } from "vitest";
import { convertDimensionToken } from "../../src/converters/dimension.js";
import type { ConversionOptions } from "../../src/types/convert.js";
import type { TokenValue } from "../../src/types/tokens.js";

describe("convertDimensionToken", () => {
    const defaultOptions: ConversionOptions = {
        path: "some.token.path",
        fluidConfig: {
            min: 320,
            max: 1200,
        },
        colorFallbackStrategy: "native",
    };

    it("should handle reference values", () => {
        const reference = "{dimension.spacing.1}";
        const result = convertDimensionToken(reference, defaultOptions);
        expect(result).toEqual({ value: reference });
    });

    it("should convert pixel values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 16,
            unit: "px",
        };
        const result = convertDimensionToken(dimension, defaultOptions);
        expect(result).toEqual({ value: "16px" });
    });

    it("should convert rem values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 1.5,
            unit: "rem",
        };
        const result = convertDimensionToken(dimension, defaultOptions);
        expect(result).toEqual({ value: "1.5rem" });
    });

    it("should handle decimal values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 0.75,
            unit: "rem",
        };
        const result = convertDimensionToken(dimension, defaultOptions);
        expect(result).toEqual({ value: "0.75rem" });
    });

    it("should handle zero values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 0,
            unit: "px",
        };
        const result = convertDimensionToken(dimension, defaultOptions);
        expect(result).toEqual({ value: "0px" });
    });

    describe("fluid extension", () => {
        it("should convert dimension with fluid extension to clamp()", () => {
            const dimension: TokenValue<"dimension"> = {
                value: 24,
                unit: "px",
            };
            const options: ConversionOptions = {
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
            const result = convertDimensionToken(dimension, options);
            expect(result.value).toMatch(/^clamp\(1rem, .* \+ .*vw, 1.5rem\)$/);
        });

        it("should convert fluid extension with rem values", () => {
            const dimension: TokenValue<"dimension"> = {
                value: 1.5,
                unit: "rem",
            };
            const options: ConversionOptions = {
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
            const result = convertDimensionToken(dimension, options);
            expect(result.value).toMatch(/^clamp\(1rem, .* \+ .*vw, 1.5rem\)$/);
        });

        it("should return static value when min and max are the same", () => {
            const dimension: TokenValue<"dimension"> = {
                value: 16,
                unit: "px",
            };
            const options: ConversionOptions = {
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
            const result = convertDimensionToken(dimension, options);
            expect(result).toEqual({ value: "1rem" });
        });

        it("should generate mathematically correct clamp values", () => {
            const dimension: TokenValue<"dimension"> = {
                value: 32,
                unit: "px",
            };
            const options: ConversionOptions = {
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
            const result = convertDimensionToken(dimension, options);
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
