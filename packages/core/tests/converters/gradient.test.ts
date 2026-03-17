import { describe, expect, it } from "vitest";
import { convertGradientToken } from "../../src/converters/gradient.js";
import type { ConversionOptions } from "../../src/types/convert.js";

const defaultOptions: ConversionOptions = {
    fluidConfig: { min: 320, max: 1200 },
    colorFallbackStrategy: "native",
};

describe("convertGradient", () => {
    it("should handle reference values", () => {
        const result = convertGradientToken("{gradients.primary}", defaultOptions);
        expect(result).toEqual({
            value: "{gradients.primary}",
        });
    });

    it("should convert basic gradient", () => {
        const result = convertGradientToken(
            [
                { color: "#000000", position: 0 },
                { color: "#FFFFFF", position: 1 },
            ],
            defaultOptions
        );

        expect(result).toEqual({
            value: "linear-gradient(#000000 0%, #FFFFFF 100%)",
        });
    });

    it("should handle references in color values", () => {
        const result = convertGradientToken(
            [
                { color: "{color.primary}", position: 0 },
                { color: "{color.secondary}", position: 1 },
            ],
            defaultOptions
        );

        expect(result).toEqual({
            value: "linear-gradient({color.primary} 0%, {color.secondary} 100%)",
        });
    });

    it("should handle references in position values", () => {
        const result = convertGradientToken(
            [
                { color: "#000000", position: "{position.start}" },
                { color: "#FFFFFF", position: "{position.end}" },
            ],
            defaultOptions
        );

        expect(result).toEqual({
            value: "linear-gradient(#000000 {position.start}%, #FFFFFF {position.end}%)",
        });
    });

    it("should handle multiple color stops", () => {
        const result = convertGradientToken(
            [
                { color: "#000000", position: 0 },
                { color: "#808080", position: 0.5 },
                { color: "#FFFFFF", position: 1 },
            ],
            defaultOptions
        );

        expect(result).toEqual({
            value: "linear-gradient(#000000 0%, #808080 50%, #FFFFFF 100%)",
        });
    });

    describe("DTCG color objects", () => {
        it("should convert sRGB color object", () => {
            const result = convertGradientToken(
                [
                    {
                        color: {
                            colorSpace: "srgb",
                            components: [0, 0, 0],
                            alpha: 0,
                        },
                        position: 0,
                    },
                    {
                        color: {
                            colorSpace: "srgb",
                            components: [0, 0, 0],
                            alpha: 1,
                        },
                        position: 1,
                    },
                ],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(rgb(0 0 0 / 0) 0%, rgb(0 0 0) 100%)",
            });
        });

        it("should convert OKLCH color object", () => {
            const result = convertGradientToken(
                [
                    {
                        color: {
                            colorSpace: "oklch",
                            components: [0.5, 0.1, 180],
                        },
                        position: 0,
                    },
                    {
                        color: {
                            colorSpace: "oklch",
                            components: [0.8, 0.2, 270],
                        },
                        position: 1,
                    },
                ],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(oklch(0.5 0.1 180) 0%, oklch(0.8 0.2 270) 100%)",
            });
        });

        it("should convert mixed hex and DTCG color objects", () => {
            const result = convertGradientToken(
                [
                    { color: "#FF0000", position: 0 },
                    {
                        color: {
                            colorSpace: "srgb",
                            components: [0, 0, 1],
                        },
                        position: 1,
                    },
                ],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(#FF0000 0%, rgb(0 0 255) 100%)",
            });
        });

        it("should convert Display P3 color object", () => {
            const result = convertGradientToken(
                [
                    {
                        color: {
                            colorSpace: "display-p3",
                            components: [1, 0, 0],
                        },
                        position: 0,
                    },
                    {
                        color: {
                            colorSpace: "display-p3",
                            components: [0, 1, 0],
                        },
                        position: 1,
                    },
                ],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(color(display-p3 1 0 0) 0%, color(display-p3 0 1 0) 100%)",
            });
        });
    });

    describe("position clamping", () => {
        it("should clamp positions greater than 1 to 100%", () => {
            const result = convertGradientToken(
                [
                    { color: "#000000", position: 0 },
                    { color: "#FFFFFF", position: 42 },
                ],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(#000000 0%, #FFFFFF 100%)",
            });
        });

        it("should clamp negative positions to 0%", () => {
            const result = convertGradientToken(
                [
                    { color: "#000000", position: -99 },
                    { color: "#FFFFFF", position: 1 },
                ],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(#000000 0%, #FFFFFF 100%)",
            });
        });

        it("should clamp both out-of-range positions", () => {
            const result = convertGradientToken(
                [
                    { color: "#FF0000", position: -5 },
                    { color: "#00FF00", position: 0.5 },
                    { color: "#0000FF", position: 100 },
                ],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(#FF0000 0%, #00FF00 50%, #0000FF 100%)",
            });
        });
    });

    describe("nested array flattening", () => {
        it("should flatten nested arrays from resolved gradient references", () => {
            const result = convertGradientToken(
                [
                    [{ color: "#FFFFFF", position: 0 }],
                    { color: "#808080", position: 0.5 },
                    [{ color: "#000000", position: 1 }],
                ] as unknown as Parameters<typeof convertGradientToken>[0],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(#FFFFFF 0%, #808080 50%, #000000 100%)",
            });
        });

        it("should handle deeply nested arrays", () => {
            const result = convertGradientToken(
                [
                    [[{ color: "#FF0000", position: 0 }]],
                    { color: "#0000FF", position: 1 },
                ] as unknown as Parameters<typeof convertGradientToken>[0],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(#FF0000 0%, #0000FF 100%)",
            });
        });

        it("should flatten multiple stops from a single reference", () => {
            const result = convertGradientToken(
                [
                    [
                        { color: "#FF0000", position: 0 },
                        { color: "#00FF00", position: 0.5 },
                    ],
                    { color: "#0000FF", position: 1 },
                ] as unknown as Parameters<typeof convertGradientToken>[0],
                defaultOptions
            );

            expect(result).toEqual({
                value: "linear-gradient(#FF0000 0%, #00FF00 50%, #0000FF 100%)",
            });
        });
    });
});
