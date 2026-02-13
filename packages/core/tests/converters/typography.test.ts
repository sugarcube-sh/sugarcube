import { describe, expect, it } from "vitest";
import { convertTypographyToken } from "../../src/converters/typography.js";

describe("convertTypography", () => {
    it("should handle reference values", () => {
        const result = convertTypographyToken("{typography.body}");
        expect(result).toEqual({
            "font-family": "{typography.body}",
            "font-size": "{typography.body}",
        });
    });

    it("should convert typography object with all properties", () => {
        const result = convertTypographyToken({
            fontFamily: ["Arial", "sans-serif"],
            fontSize: { value: 16, unit: "px" },
            fontWeight: 400,
            letterSpacing: { value: 0.5, unit: "px" },
            lineHeight: 1.5,
        });

        expect(result).toEqual({
            "font-family": "Arial, sans-serif",
            "font-size": "16px",
            "font-weight": 400,
            "letter-spacing": "0.5px",
            "line-height": 1.5,
        });
    });

    it("should convert typography object with string font weight", () => {
        const result = convertTypographyToken({
            fontFamily: ["Arial"],
            fontSize: { value: 16, unit: "px" },
            fontWeight: "bold",
            lineHeight: 1.2,
        });

        expect(result).toEqual({
            "font-family": "Arial",
            "font-size": "16px",
            "font-weight": 700,
            "line-height": 1.2,
        });
    });

    it("should handle reference values for individual properties", () => {
        const result = convertTypographyToken({
            fontFamily: "{typography.family.sans}",
            fontSize: "{typography.size.base}",
            fontWeight: "{typography.weight.bold}",
            letterSpacing: "{typography.spacing.normal}",
            lineHeight: "{typography.leading.normal}",
        });

        expect(result).toEqual({
            "font-family": "{typography.family.sans}",
            "font-size": "{typography.size.base}",
            "font-weight": "{typography.weight.bold}",
            "letter-spacing": "{typography.spacing.normal}",
            "line-height": "{typography.leading.normal}",
        });
    });

    it("should handle optional properties correctly", () => {
        const result = convertTypographyToken({
            fontFamily: ["Arial"],
            fontSize: { value: 16, unit: "px" },
        });

        expect(result).toEqual({
            "font-family": "Arial",
            "font-size": "16px",
        });
    });

    it("should handle single string font family", () => {
        const result = convertTypographyToken({
            fontFamily: "Arial",
            fontSize: { value: 16, unit: "px" },
        });

        expect(result).toEqual({
            "font-family": "Arial",
            "font-size": "16px",
        });
    });
});
