import { describe, expect, it } from "vitest";
import { convertColorToken } from "../../src/converters/color.js";
import type { ConversionOptions } from "../../src/types/convert.js";

const createOptions = (overrides: Partial<ConversionOptions> = {}): ConversionOptions => ({
    fluidConfig: { min: 320, max: 1200 },
    colorFallbackStrategy: "native",
    ...overrides,
});

describe("convertColorToken", () => {
    it("should preserve references", () => {
        const reference = "{color.primary.500}";
        expect(convertColorToken(reference, createOptions({ path: "test" }))).toEqual({
            value: reference,
        });
    });

    it("should pass through hex strings unchanged", () => {
        const hex = "#FF0000";
        expect(convertColorToken(hex, createOptions({ path: "test" }))).toEqual({
            value: "#FF0000",
        });

        const hexWithAlpha = "#FF000080";
        expect(convertColorToken(hexWithAlpha, createOptions({ path: "test" }))).toEqual({
            value: "#FF000080",
        });
    });

    it("should handle invalid hex strings gracefully", () => {
        const invalidHex = "#XY0000";
        expect(convertColorToken(invalidHex, createOptions({ path: "test" }))).toEqual({
            value: invalidHex,
        });
    });

    it("should handle DTCG color objects with native strategy (default)", () => {
        const oklchColor = {
            colorSpace: "oklch" as const,
            components: [0.7016, 0.3225, 328.363] as [number, number, number],
            alpha: 0.8,
        };

        const result = convertColorToken(
            oklchColor,
            createOptions({ colorFallbackStrategy: "native" })
        );
        expect(result.value).toBe("oklch(0.7016 0.3225 328.363 / 0.8)");
        expect(result.featureValues).toBeUndefined();
    });

    it("should handle DTCG color objects with polyfill strategy", () => {
        const oklchColorWithHex = {
            colorSpace: "oklch" as const,
            components: [0.7016, 0.3225, 328.363] as [number, number, number],
            alpha: 0.8,
            hex: "#ff00ff",
        };

        const result = convertColorToken(
            oklchColorWithHex,
            createOptions({ colorFallbackStrategy: "polyfill" })
        );
        expect(result.value).toBe("#ff00ff"); // Hex fallback
        expect(result.featureValues).toBeDefined();
        expect(result.featureValues?.[0]?.query).toBe("@supports (color: oklch(0 0 0))");
        expect(result.featureValues?.[0]?.value).toBe("oklch(0.7016 0.3225 328.363 / 0.8)");
    });

    it("should throw error for DTCG colors without hex fallback in polyfill mode", () => {
        const oklchColor = {
            colorSpace: "oklch" as const,
            components: [0.7016, 0.3225, 328.363] as [number, number, number],
        };

        expect(() => {
            convertColorToken(oklchColor, createOptions({ colorFallbackStrategy: "polyfill" }));
        }).toThrow("oklch colors require a 'hex' fallback when using 'polyfill' strategy");
    });
});
