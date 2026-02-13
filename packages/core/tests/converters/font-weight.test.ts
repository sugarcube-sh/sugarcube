import { describe, expect, it } from "vitest";
import { convertFontWeightToken } from "../../src/converters/font-weight.js";

describe("convertFontWeight", () => {
    it("should handle reference values", () => {
        const result = convertFontWeightToken("{typography.weight.bold}");
        expect(result).toEqual({
            value: "{typography.weight.bold}",
        });
    });

    it("should handle numeric weights", () => {
        const result = convertFontWeightToken(400);
        expect(result).toEqual({
            value: 400,
        });
    });

    it("should convert string aliases to numbers", () => {
        const testCases = [
            ["bold", 700],
            ["regular", 400],
            ["light", 300],
            ["medium", 500],
            ["black", 900],
            ["thin", 100],
            ["extra-bold", 800],
            ["semi-bold", 600],
        ];

        for (const [input, expected] of testCases) {
            const result = convertFontWeightToken(input as string);
            expect(result).toEqual({
                value: expected,
            });
        }
    });

    it("should handle case-insensitive string aliases", () => {
        const result = convertFontWeightToken("BOLD");
        expect(result).toEqual({
            value: 700,
        });
    });
});
