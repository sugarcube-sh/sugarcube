import { describe, expect, it } from "vitest";
import { convertBorderToken } from "../../src/converters/border.js";
import type { ConversionOptions } from "../../src/types/convert.js";

const defaultOptions: ConversionOptions = {
    fluidConfig: { min: 320, max: 1200 },
    colorFallbackStrategy: "native",
};

describe("convertBorder", () => {
    it("should preserve references", () => {
        const result = convertBorderToken("{border.default}", defaultOptions);
        expect(result).toEqual({
            value: "{border.default}",
        });
    });

    it("should convert basic border object", () => {
        const result = convertBorderToken(
            {
                color: "#000000",
                width: { value: 1, unit: "px" },
                style: "solid",
            },
            defaultOptions
        );

        expect(result).toEqual({
            value: "1px solid #000000",
        });
    });

    it("should handle references in individual properties", () => {
        const result = convertBorderToken(
            {
                color: "{color.primary}",
                width: "{spacing.hairline}",
                style: "{borderStyles.default}",
            },
            defaultOptions
        );

        expect(result).toEqual({
            value: "{spacing.hairline} {borderStyles.default} {color.primary}",
        });
    });

    it("should handle custom stroke style objects", () => {
        const result = convertBorderToken(
            {
                color: "#000000",
                width: { value: 1, unit: "px" },
                style: {
                    dashArray: [
                        { value: 4, unit: "px" },
                        { value: 2, unit: "px" },
                    ],
                    lineCap: "round",
                },
            },
            defaultOptions
        );

        expect(result).toEqual({
            value: "1px 4px 2px round #000000",
        });
    });

    describe("DTCG color objects", () => {
        it("should convert sRGB color object", () => {
            const result = convertBorderToken(
                {
                    color: {
                        colorSpace: "srgb",
                        components: [1, 0, 0],
                    },
                    width: { value: 2, unit: "px" },
                    style: "solid",
                },
                defaultOptions
            );

            expect(result).toEqual({
                value: "2px solid rgb(255 0 0)",
            });
        });

        it("should convert OKLCH color object", () => {
            const result = convertBorderToken(
                {
                    color: {
                        colorSpace: "oklch",
                        components: [0.7, 0.15, 200],
                        alpha: 0.8,
                    },
                    width: { value: 1, unit: "px" },
                    style: "dashed",
                },
                defaultOptions
            );

            expect(result).toEqual({
                value: "1px dashed oklch(0.7 0.15 200 / 0.8)",
            });
        });

        it("should convert Display P3 color object", () => {
            const result = convertBorderToken(
                {
                    color: {
                        colorSpace: "display-p3",
                        components: [0, 1, 0],
                    },
                    width: { value: 3, unit: "px" },
                    style: "dotted",
                },
                defaultOptions
            );

            expect(result).toEqual({
                value: "3px dotted color(display-p3 0 1 0)",
            });
        });
    });
});
