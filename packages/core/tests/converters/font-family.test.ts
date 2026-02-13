import { describe, expect, it } from "vitest";
import { convertFontFamilyToken } from "../../src/converters/font-family.js";

describe("convertFontFamily", () => {
    it("should handle reference values", () => {
        const result = convertFontFamilyToken("{fonts.sans}");
        expect(result).toEqual({
            value: "{fonts.sans}",
        });
    });

    it("should handle single font name", () => {
        const result = convertFontFamilyToken("Arial");
        expect(result).toEqual({
            value: "Arial",
        });
    });

    it("should quote font names with spaces", () => {
        const result = convertFontFamilyToken("Comic Sans MS");
        expect(result).toEqual({
            value: '"Comic Sans MS"',
        });
    });

    it("should handle array of font names", () => {
        const result = convertFontFamilyToken(["Helvetica Neue", "Arial", "sans-serif"]);
        expect(result).toEqual({
            value: '"Helvetica Neue", Arial, sans-serif',
        });
    });
});
