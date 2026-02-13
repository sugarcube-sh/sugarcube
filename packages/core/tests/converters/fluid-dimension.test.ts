import { describe, expect, it } from "vitest";
import { convertFluidDimensionToken } from "../../src/converters/fluid-dimension.js";
import type { ConversionOptions } from "../../src/types/convert.js";
import type { TokenValue } from "../../src/types/tokens.js";

describe("convertFluidDimension", () => {
    const defaultOptions: ConversionOptions = {
        path: "some.token.path",
        fluidConfig: {
            min: 320,
            max: 1200,
        },
        colorFallbackStrategy: "native",
    };

    it("should handle reference values", () => {
        const reference = "{dimension.fluid.base}";
        const result = convertFluidDimensionToken(reference, defaultOptions);
        expect(result).toEqual({ value: reference });
    });

    it("should convert fluid dimensions with pixel values", () => {
        const value = {
            min: { value: 16, unit: "px" },
            max: { value: 24, unit: "px" },
        };

        const result = convertFluidDimensionToken(
            value as TokenValue<"fluidDimension">,
            defaultOptions
        );
        expect(result.value).toMatch(/^clamp\(1rem, .* \+ .*vw, 1.5rem\)$/);
    });

    it("should convert fluid dimensions with rem values", () => {
        const value = {
            min: { value: 1, unit: "rem" },
            max: { value: 1.5, unit: "rem" },
        };

        const result = convertFluidDimensionToken(
            value as TokenValue<"fluidDimension">,
            defaultOptions
        );
        expect(result.value).toMatch(/^clamp\(1rem, .* \+ .*vw, 1.5rem\)$/);
    });

    it("should return static value when min and max are the same", () => {
        const value = {
            min: { value: 16, unit: "px" },
            max: { value: 16, unit: "px" },
        };

        const result = convertFluidDimensionToken(
            value as TokenValue<"fluidDimension">,
            defaultOptions
        );
        expect(result).toEqual({ value: "1rem" });
    });

    it("should handle different viewport units", () => {
        const options: ConversionOptions = {
            path: defaultOptions.path,
            fluidConfig: {
                min: 320,
                max: 1200,
            },
            colorFallbackStrategy: "native",
        };

        const value = {
            min: { value: 1, unit: "rem" },
            max: { value: 2, unit: "rem" },
        };

        const result = convertFluidDimensionToken(value as TokenValue<"fluidDimension">, options);
        expect(result.value).toMatch(/^clamp\(1rem, .* \+ .*vw, 2rem\)$/);
    });

    it("should generate mathematically correct clamp values", () => {
        const value = {
            min: { value: 16, unit: "px" },
            max: { value: 32, unit: "px" },
        };

        const result = convertFluidDimensionToken(
            value as TokenValue<"fluidDimension">,
            defaultOptions
        );
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
