import { describe, expect, it } from "vitest";
import { convertColorToString } from "../src/color/color-conversion.js";
import type { DTCGColorValue } from "../src/types/dtcg-color.js";

describe("convertColorToString", () => {
    describe("hex strings", () => {
        it("should pass through hex colors unchanged", () => {
            expect(convertColorToString("#ff0000")).toEqual({ success: true, value: "#ff0000" });
            expect(convertColorToString("#00ff00")).toEqual({ success: true, value: "#00ff00" });
            expect(convertColorToString("#0000ff")).toEqual({ success: true, value: "#0000ff" });
        });

        it("should pass through hex colors with alpha unchanged", () => {
            expect(convertColorToString("#ff000080")).toEqual({
                success: true,
                value: "#ff000080",
            });
            expect(convertColorToString("#00ff0040")).toEqual({
                success: true,
                value: "#00ff0040",
            });
            expect(convertColorToString("#0000ff33")).toEqual({
                success: true,
                value: "#0000ff33",
            });
        });
    });

    describe("DTCG color objects", () => {
        it("should format OKLCH colors", () => {
            const oklchColor: DTCGColorValue = {
                colorSpace: "oklch",
                components: [0.7016, 0.3225, 328.363],
                alpha: 0.8,
            };
            expect(convertColorToString(oklchColor)).toEqual({
                success: true,
                value: "oklch(0.7016 0.3225 328.363 / 0.8)",
            });
        });

        it("should format OKLCH colors without alpha", () => {
            const oklchColor: DTCGColorValue = {
                colorSpace: "oklch",
                components: [0.7016, 0.3225, 328.363],
            };
            expect(convertColorToString(oklchColor)).toEqual({
                success: true,
                value: "oklch(0.7016 0.3225 328.363)",
            });
        });

        it("should format Display P3 colors", () => {
            const p3Color: DTCGColorValue = {
                colorSpace: "display-p3",
                components: [0.9, 0.2, 0.1],
                alpha: 0.5,
            };
            expect(convertColorToString(p3Color)).toEqual({
                success: true,
                value: "color(display-p3 0.9 0.2 0.1 / 0.5)",
            });
        });

        it("should format Display P3 colors without alpha", () => {
            const p3Color: DTCGColorValue = {
                colorSpace: "display-p3",
                components: [0.9, 0.2, 0.1],
            };
            expect(convertColorToString(p3Color)).toEqual({
                success: true,
                value: "color(display-p3 0.9 0.2 0.1)",
            });
        });

        it("should handle unsupported color spaces as regular strings", () => {
            const unsupportedColor = {
                colorSpace: "lab",
                components: [50, 20, -30],
            } as any;
            // This won't be recognized as a DTCG color, so it will be treated as a string
            expect(convertColorToString(unsupportedColor)).toEqual({
                success: true,
                value: unsupportedColor,
            });
        });
    });

    describe("error handling", () => {
        it("should handle invalid hex values gracefully", () => {
            expect(convertColorToString("#XY0000")).toEqual({ success: true, value: "#XY0000" });
            expect(convertColorToString("not-a-color")).toEqual({
                success: true,
                value: "not-a-color",
            });
        });
    });
});
