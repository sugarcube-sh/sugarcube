import { describe, expect, it } from "vitest";
import { renderFontFamily } from "../../../src/shared/renderers/css/font-family.js";

describe("convertFontFamily", () => {
    it("should handle reference values", () => {
        const result = renderFontFamily("{fonts.sans}");
        expect(result).toEqual({
            value: "{fonts.sans}",
        });
    });

    it("should handle single font name", () => {
        const result = renderFontFamily("Arial");
        expect(result).toEqual({
            value: "Arial",
        });
    });

    it("should quote font names with spaces", () => {
        const result = renderFontFamily("Comic Sans MS");
        expect(result).toEqual({
            value: '"Comic Sans MS"',
        });
    });

    it("should handle array of font names", () => {
        const result = renderFontFamily(["Helvetica Neue", "Arial", "sans-serif"]);
        expect(result).toEqual({
            value: '"Helvetica Neue", Arial, sans-serif',
        });
    });
});
