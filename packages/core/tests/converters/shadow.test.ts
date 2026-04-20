import { describe, expect, it } from "vitest";
import { convertShadowToken } from "../../src/shared/converters/shadow.js";
import type { ConversionOptions } from "../../src/types/convert.js";

const defaultOptions: ConversionOptions = {
    fluidConfig: { min: 320, max: 1200 },
    colorFallbackStrategy: "native",
};

describe("convertShadow", () => {
    it("should handle reference values", () => {
        const result = convertShadowToken("{shadows.default}", defaultOptions);
        expect(result).toEqual({
            value: "{shadows.default}",
        });
    });

    it("should convert single shadow object", () => {
        const result = convertShadowToken(
            {
                offsetX: { value: 0, unit: "px" },
                offsetY: { value: 2, unit: "px" },
                blur: { value: 4, unit: "px" },
                spread: { value: 0, unit: "px" },
                color: "#000000",
            },
            defaultOptions
        );

        expect(result).toEqual({
            value: "0px 2px 4px 0px #000000",
        });
    });

    it("should handle inset shadows", () => {
        const result = convertShadowToken(
            {
                offsetX: { value: 0, unit: "px" },
                offsetY: { value: 2, unit: "px" },
                blur: { value: 4, unit: "px" },
                spread: { value: 0, unit: "px" },
                color: "#000000",
                inset: true,
            },
            defaultOptions
        );

        expect(result).toEqual({
            value: "inset 0px 2px 4px 0px #000000",
        });
    });

    it("should handle multiple shadows", () => {
        const result = convertShadowToken(
            [
                {
                    offsetX: { value: 0, unit: "px" },
                    offsetY: { value: 2, unit: "px" },
                    blur: { value: 4, unit: "px" },
                    spread: { value: 0, unit: "px" },
                    color: "#000000",
                    inset: true,
                },
                {
                    offsetX: { value: 0, unit: "px" },
                    offsetY: { value: 4, unit: "px" },
                    blur: { value: 8, unit: "px" },
                    spread: { value: 0, unit: "px" },
                    color: "rgba(0,0,0,0.2)",
                },
            ],
            defaultOptions
        );

        expect(result).toEqual({
            value: "inset 0px 2px 4px 0px #000000, 0px 4px 8px 0px rgba(0,0,0,0.2)",
        });
    });

    it("should handle references in properties", () => {
        const result = convertShadowToken(
            {
                offsetX: "{spacing.none}",
                offsetY: "{spacing.small}",
                blur: "{spacing.medium}",
                spread: "{spacing.none}",
                color: "{color.shadow}",
            },
            defaultOptions
        );

        expect(result).toEqual({
            value: "{spacing.none} {spacing.small} {spacing.medium} {spacing.none} {color.shadow}",
        });
    });

    describe("DTCG color objects", () => {
        it("should convert sRGB color object", () => {
            const result = convertShadowToken(
                {
                    offsetX: { value: 0, unit: "px" },
                    offsetY: { value: 2, unit: "px" },
                    blur: { value: 4, unit: "px" },
                    spread: { value: 0, unit: "px" },
                    color: {
                        colorSpace: "srgb",
                        components: [0, 0, 0],
                        alpha: 0.5,
                    },
                },
                defaultOptions
            );

            expect(result).toEqual({
                value: "0px 2px 4px 0px rgb(0 0 0 / 0.5)",
            });
        });

        it("should convert HSL color object", () => {
            const result = convertShadowToken(
                {
                    offsetX: { value: 5, unit: "px" },
                    offsetY: { value: 5, unit: "px" },
                    blur: { value: 10, unit: "px" },
                    spread: { value: 0, unit: "px" },
                    color: {
                        colorSpace: "hsl",
                        components: [0, 0, 0],
                        alpha: 0.17,
                    },
                },
                defaultOptions
            );

            expect(result).toEqual({
                value: "5px 5px 10px 0px hsl(0 0% 0% / 0.17)",
            });
        });

        it("should convert OKLCH color object", () => {
            const result = convertShadowToken(
                {
                    offsetX: { value: 0, unit: "rem" },
                    offsetY: { value: 0.5, unit: "rem" },
                    blur: { value: 1, unit: "rem" },
                    spread: { value: 0, unit: "rem" },
                    color: {
                        colorSpace: "oklch",
                        components: [0.5, 0.1, 180],
                        alpha: 0.8,
                    },
                },
                defaultOptions
            );

            expect(result).toEqual({
                value: "0rem 0.5rem 1rem 0rem oklch(0.5 0.1 180 / 0.8)",
            });
        });

        it("should convert Display P3 color object", () => {
            const result = convertShadowToken(
                {
                    offsetX: { value: 2, unit: "px" },
                    offsetY: { value: 2, unit: "px" },
                    blur: { value: 4, unit: "px" },
                    spread: { value: 0, unit: "px" },
                    color: {
                        colorSpace: "display-p3",
                        components: [0.5, 0.5, 0.5],
                    },
                },
                defaultOptions
            );

            expect(result).toEqual({
                value: "2px 2px 4px 0px color(display-p3 0.5 0.5 0.5)",
            });
        });

        it("should convert multiple shadows with DTCG color objects", () => {
            const result = convertShadowToken(
                [
                    {
                        offsetX: { value: 0.3, unit: "px" },
                        offsetY: { value: 0.5, unit: "px" },
                        blur: { value: 0.5, unit: "px" },
                        spread: { value: 0, unit: "px" },
                        color: {
                            colorSpace: "hsl",
                            components: [0, 0, 0],
                            alpha: 0.17,
                        },
                    },
                    {
                        offsetX: { value: 1, unit: "px" },
                        offsetY: { value: 2, unit: "px" },
                        blur: { value: 4, unit: "px" },
                        spread: { value: 0, unit: "px" },
                        color: {
                            colorSpace: "srgb",
                            components: [0, 0, 0],
                            alpha: 0.1,
                        },
                    },
                ],
                defaultOptions
            );

            expect(result).toEqual({
                value: "0.3px 0.5px 0.5px 0px hsl(0 0% 0% / 0.17), 1px 2px 4px 0px rgb(0 0 0 / 0.1)",
            });
        });
    });
});
