import { describe, expect, it } from "vitest";
import { convertColorToString } from "../src/color/color-conversion.js";
import {
    formatDTCGColorToOKLCH,
    isDTCGColorValue,
    validateDTCGColorValue,
} from "../src/color/color-validation.js";
import { convertColorToken } from "../src/converters/color.js";
import type { ConversionOptions } from "../src/types/convert.js";
import type { DTCGColorValue } from "../src/types/dtcg-color.js";

const createOptions = (overrides: Partial<ConversionOptions> = {}): ConversionOptions => ({
    fluidConfig: { min: 320, max: 1200 },
    colorFallbackStrategy: "native",
    ...overrides,
});

const validColors: Array<{ name: string; color: DTCGColorValue }> = [
    {
        name: "oklch with alpha",
        color: { colorSpace: "oklch", components: [0.7016, 0.3225, 328.363], alpha: 0.8 },
    },
    {
        name: "oklch without alpha",
        color: { colorSpace: "oklch", components: [0.7016, 0.3225, 328.363] },
    },
    {
        name: "oklch with hex",
        color: {
            colorSpace: "oklch",
            components: [0.7016, 0.3225, 328.363],
            alpha: 0.8,
            hex: "#ff00ff",
        },
    },
    {
        name: "oklch with none component",
        color: { colorSpace: "oklch", components: ["none", 0.3, 270], alpha: 0.8 },
    },
    {
        name: "display-p3 with alpha",
        color: { colorSpace: "display-p3", components: [0.9, 0.2, 0.1], alpha: 0.5 },
    },
    {
        name: "display-p3 with hex",
        color: { colorSpace: "display-p3", components: [0.9, 0.2, 0.1], hex: "#e63946" },
    },
    {
        name: "display-p3 with none component",
        color: { colorSpace: "display-p3", components: [0.9, "none", 0.1] },
    },
    {
        name: "srgb with alpha",
        color: { colorSpace: "srgb", components: [0.8, 0.4, 0.2], alpha: 0.9 },
    },
    { name: "srgb without alpha", color: { colorSpace: "srgb", components: [1, 0, 0.5] } },
    {
        name: "srgb with none components",
        color: { colorSpace: "srgb", components: ["none", "none", 0.5], alpha: 0.7 },
    },
    { name: "hsl with alpha", color: { colorSpace: "hsl", components: [270, 80, 60], alpha: 0.7 } },
    { name: "hsl without alpha", color: { colorSpace: "hsl", components: [120, 100, 50] } },
    {
        name: "hsl with none component",
        color: { colorSpace: "hsl", components: [180, "none", 75] },
    },
];

const invalidTypeGuardInputs: Array<{ name: string; value: unknown }> = [
    { name: "null", value: null },
    { name: "undefined", value: undefined },
    { name: "hex string", value: "#ff0000" },
    { name: "empty object", value: {} },
    { name: "unsupported colorSpace", value: { colorSpace: "rgb" } },
    { name: "missing components", value: { colorSpace: "oklch" } },
    { name: "wrong component count (2)", value: { colorSpace: "oklch", components: [1, 2] } },
    { name: "wrong component count (4)", value: { colorSpace: "oklch", components: [1, 2, 3, 4] } },
    { name: "non-numeric components", value: { colorSpace: "oklch", components: ["a", "b", "c"] } },
    {
        name: "invalid alpha type",
        value: { colorSpace: "oklch", components: [0.7, 0.3, 328], alpha: "invalid" },
    },
    {
        name: "invalid hex type",
        value: { colorSpace: "oklch", components: [0.7, 0.3, 328], hex: 123 },
    },
];

describe("DTCG Color Support", () => {
    describe("isDTCGColorValue", () => {
        it.each(validColors)("returns true for $name", ({ color }) => {
            expect(isDTCGColorValue(color)).toBe(true);
        });

        it.each(invalidTypeGuardInputs)("returns false for $name", ({ value }) => {
            expect(isDTCGColorValue(value)).toBe(false);
        });
    });

    describe("validateDTCGColorValue", () => {
        it.each(validColors)("returns no errors for $name", ({ color }) => {
            expect(validateDTCGColorValue(color)).toEqual([]);
        });

        it("rejects unsupported colorSpace", () => {
            const errors = validateDTCGColorValue({
                colorSpace: "rgb" as any,
                components: [0.7, 0.3, 328] as [number, number, number],
            });
            expect(errors).toContain(
                'Unsupported colorSpace: "rgb". Supported color spaces: oklch, display-p3, srgb, hsl.'
            );
        });

        it("rejects wrong component count", () => {
            const errors = validateDTCGColorValue({
                colorSpace: "oklch" as const,
                components: [0.7, 0.3] as any,
            });
            expect(errors).toContain("Components must be an array of exactly 3 numbers.");
        });

        it("rejects out-of-range OKLCH components", () => {
            const errors = validateDTCGColorValue({
                colorSpace: "oklch" as const,
                components: [-0.1, -0.1, 361] as [number, number, number],
            });
            expect(errors).toContain("OKLCH Lightness (L) must be between 0 and 1 or 'none'.");
            expect(errors).toContain("OKLCH Chroma (C) must be >= 0 or 'none'.");
            expect(errors).toContain(
                "OKLCH Hue (H) must be between 0 and 360 (exclusive) or 'none'."
            );
        });

        it("rejects out-of-range Display P3 components", () => {
            const errors = validateDTCGColorValue({
                colorSpace: "display-p3" as const,
                components: [-0.1, 1.5, -0.2] as [number, number, number],
            });
            expect(errors).toContain("Display P3 Red component must be between 0 and 1 or 'none'.");
            expect(errors).toContain(
                "Display P3 Green component must be between 0 and 1 or 'none'."
            );
            expect(errors).toContain(
                "Display P3 Blue component must be between 0 and 1 or 'none'."
            );
        });

        it("rejects out-of-range sRGB components", () => {
            const errors = validateDTCGColorValue({
                colorSpace: "srgb" as const,
                components: [-0.1, 1.5, -0.2] as [number, number, number],
            });
            expect(errors).toContain("sRGB Red component must be between 0 and 1 or 'none'.");
            expect(errors).toContain("sRGB Green component must be between 0 and 1 or 'none'.");
            expect(errors).toContain("sRGB Blue component must be between 0 and 1 or 'none'.");
        });

        it("rejects out-of-range HSL components", () => {
            const errors = validateDTCGColorValue({
                colorSpace: "hsl" as const,
                components: [-10, 150, -20] as [number, number, number],
            });
            expect(errors).toContain("HSL Hue must be between 0 and 360 (exclusive) or 'none'.");
            expect(errors).toContain("HSL Saturation must be between 0 and 100 or 'none'.");
            expect(errors).toContain("HSL Lightness must be between 0 and 100 or 'none'.");
        });

        it("rejects out-of-range alpha", () => {
            const errors = validateDTCGColorValue({
                colorSpace: "oklch" as const,
                components: [0.7, 0.3, 328] as [number, number, number],
                alpha: 1.5,
            });
            expect(errors).toContain("Alpha must be between 0 and 1.");
        });
    });

    describe("formatDTCGColorToOKLCH", () => {
        const formatCases = [
            {
                name: "without alpha",
                color: { colorSpace: "oklch", components: [0.7016, 0.3225, 328.363] },
                expected: "oklch(0.7016 0.3225 328.363)",
            },
            {
                name: "with alpha",
                color: { colorSpace: "oklch", components: [0.7016, 0.3225, 328.363], alpha: 0.8 },
                expected: "oklch(0.7016 0.3225 328.363 / 0.8)",
            },
            {
                name: "with alpha = 1 (omitted)",
                color: { colorSpace: "oklch", components: [0.7016, 0.3225, 328.363], alpha: 1 },
                expected: "oklch(0.7016 0.3225 328.363)",
            },
            {
                name: "with extreme zeros",
                color: { colorSpace: "oklch", components: [0, 0, 0], alpha: 0 },
                expected: "oklch(0 0 0 / 0)",
            },
            {
                name: "with max values",
                color: { colorSpace: "oklch", components: [1, 0.5, 359.9999] },
                expected: "oklch(1 0.5 359.9999)",
            },
        ] as const;

        it.each(formatCases)("formats OKLCH $name", ({ color, expected }) => {
            expect(formatDTCGColorToOKLCH(color as DTCGColorValue)).toEqual({
                success: true,
                value: expected,
            });
        });

        it("rounds components to 4 decimal places", () => {
            const color: DTCGColorValue = {
                colorSpace: "oklch",
                components: [0.701632789, 0.322501234, 328.363456789],
                alpha: 0.800001,
            };
            expect(formatDTCGColorToOKLCH(color)).toEqual({
                success: true,
                value: "oklch(0.7016 0.3225 328.3635 / 0.8)",
            });
        });

        it("returns error for unsupported colorSpace", () => {
            const result = formatDTCGColorToOKLCH({
                colorSpace: "rgb" as any,
                components: [0.7, 0.3, 328] as [number, number, number],
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toContain("Unsupported colorSpace");
            }
        });
    });

    describe("convertColorToString", () => {
        const conversionCases = [
            {
                name: "oklch with alpha",
                color: { colorSpace: "oklch", components: [0.7016, 0.3225, 328.363], alpha: 0.8 },
                expected: "oklch(0.7016 0.3225 328.363 / 0.8)",
            },
            {
                name: "display-p3 with alpha",
                color: { colorSpace: "display-p3", components: [0.9, 0.2, 0.1], alpha: 0.5 },
                expected: "color(display-p3 0.9 0.2 0.1 / 0.5)",
            },
            {
                name: "srgb with alpha",
                color: { colorSpace: "srgb", components: [0.8, 0.4, 0.2], alpha: 0.9 },
                expected: "rgb(204 102 51 / 0.9)",
            },
            {
                name: "srgb without alpha",
                color: { colorSpace: "srgb", components: [1, 0, 0.5] },
                expected: "rgb(255 0 128)",
            },
            {
                name: "hsl with alpha",
                color: { colorSpace: "hsl", components: [270, 80, 60], alpha: 0.7 },
                expected: "hsl(270 80% 60% / 0.7)",
            },
            {
                name: "hsl without alpha",
                color: { colorSpace: "hsl", components: [120, 100, 50] },
                expected: "hsl(120 100% 50%)",
            },
            {
                name: "oklch with none",
                color: { colorSpace: "oklch", components: ["none", 0.3, 270], alpha: 0.8 },
                expected: "oklch(none 0.3 270 / 0.8)",
            },
            {
                name: "display-p3 with none",
                color: { colorSpace: "display-p3", components: [0.9, "none", 0.1] },
                expected: "color(display-p3 0.9 none 0.1)",
            },
            {
                name: "srgb with none",
                color: { colorSpace: "srgb", components: ["none", "none", 0.5], alpha: 0.7 },
                expected: "rgb(none none 128 / 0.7)",
            },
            {
                name: "hsl with none",
                color: { colorSpace: "hsl", components: [180, "none", 75] },
                expected: "hsl(180 none 75%)",
            },
        ] as const;

        it.each(conversionCases)("converts $name", ({ color, expected }) => {
            expect(convertColorToString(color as DTCGColorValue)).toEqual({
                success: true,
                value: expected,
            });
        });

        it("passes through hex strings unchanged", () => {
            expect(convertColorToString("#ff0000")).toEqual({ success: true, value: "#ff0000" });
        });
    });

    describe("convertColorToken", () => {
        describe("native strategy", () => {
            const nativeCases = [
                {
                    name: "oklch",
                    color: {
                        colorSpace: "oklch",
                        components: [0.7016, 0.3225, 328.363],
                        alpha: 0.8,
                    },
                    expected: "oklch(0.7016 0.3225 328.363 / 0.8)",
                },
                {
                    name: "display-p3",
                    color: { colorSpace: "display-p3", components: [0.9, 0.2, 0.1], alpha: 0.5 },
                    expected: "color(display-p3 0.9 0.2 0.1 / 0.5)",
                },
                {
                    name: "srgb",
                    color: { colorSpace: "srgb", components: [0.8, 0.4, 0.2], alpha: 0.9 },
                    expected: "rgb(204 102 51 / 0.9)",
                },
                {
                    name: "hsl",
                    color: { colorSpace: "hsl", components: [270, 80, 60], alpha: 0.7 },
                    expected: "hsl(270 80% 60% / 0.7)",
                },
            ] as const;

            it.each(nativeCases)("converts $name without featureValues", ({ color, expected }) => {
                const result = convertColorToken(
                    color as DTCGColorValue,
                    createOptions({ colorFallbackStrategy: "native" })
                );
                expect(result.value).toBe(expected);
                expect(result.featureValues).toBeUndefined();
            });

            it("passes through hex strings", () => {
                const result = convertColorToken(
                    "#ff0000",
                    createOptions({ colorFallbackStrategy: "native" })
                );
                expect(result.value).toBe("#ff0000");
            });

            it("passes through references", () => {
                const result = convertColorToken(
                    "{color.primary}",
                    createOptions({ colorFallbackStrategy: "native" })
                );
                expect(result.value).toBe("{color.primary}");
            });
        });

        describe("polyfill strategy", () => {
            it("uses hex fallback with @supports query for oklch", () => {
                const color: DTCGColorValue = {
                    colorSpace: "oklch",
                    components: [0.7016, 0.3225, 328.363],
                    alpha: 0.8,
                    hex: "#ff00ff",
                };
                const result = convertColorToken(
                    color,
                    createOptions({ colorFallbackStrategy: "polyfill" })
                );
                expect(result.value).toBe("#ff00ff");
                expect(result.featureValues?.[0]?.query).toBe("@supports (color: oklch(0 0 0))");
                expect(result.featureValues?.[0]?.value).toBe("oklch(0.7016 0.3225 328.363 / 0.8)");
            });

            it("uses hex fallback with @supports query for display-p3", () => {
                const color: DTCGColorValue = {
                    colorSpace: "display-p3",
                    components: [0.9, 0.2, 0.1],
                    hex: "#e63946",
                };
                const result = convertColorToken(
                    color,
                    createOptions({ colorFallbackStrategy: "polyfill" })
                );
                expect(result.value).toBe("#e63946");
                expect(result.featureValues?.[0]?.query).toBe(
                    "@supports (color: color(display-p3 1 1 1))"
                );
                expect(result.featureValues?.[0]?.value).toBe("color(display-p3 0.9 0.2 0.1)");
            });

            it("throws when oklch color lacks hex fallback", () => {
                const color: DTCGColorValue = {
                    colorSpace: "oklch",
                    components: [0.7016, 0.3225, 328.363],
                    alpha: 0.8,
                };
                expect(() =>
                    convertColorToken(color, createOptions({ colorFallbackStrategy: "polyfill" }))
                ).toThrow("oklch colors require a 'hex' fallback when using 'polyfill' strategy");
            });

            it("treats srgb like native (universally supported)", () => {
                const color: DTCGColorValue = {
                    colorSpace: "srgb",
                    components: [0.8, 0.4, 0.2],
                    alpha: 0.9,
                };
                const result = convertColorToken(
                    color,
                    createOptions({ colorFallbackStrategy: "polyfill" })
                );
                expect(result.value).toBe("rgb(204 102 51 / 0.9)");
                expect(result.featureValues).toBeUndefined();
            });

            it("treats hsl like native (universally supported)", () => {
                const color: DTCGColorValue = {
                    colorSpace: "hsl",
                    components: [270, 80, 60],
                    alpha: 0.7,
                };
                const result = convertColorToken(
                    color,
                    createOptions({ colorFallbackStrategy: "polyfill" })
                );
                expect(result.value).toBe("hsl(270 80% 60% / 0.7)");
                expect(result.featureValues).toBeUndefined();
            });

            it("passes through hex strings without polyfill", () => {
                const result = convertColorToken(
                    "#ff0000",
                    createOptions({ colorFallbackStrategy: "polyfill" })
                );
                expect(result.value).toBe("#ff0000");
                expect(result.featureValues).toBeUndefined();
            });
        });
    });
});
