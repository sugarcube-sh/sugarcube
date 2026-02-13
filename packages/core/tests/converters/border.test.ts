import { describe, expect, it } from "vitest";
import { convertBorderToken } from "../../src/converters/border.js";

describe("convertBorder", () => {
    it("should preserve references", () => {
        const result = convertBorderToken("{border.default}");
        expect(result).toEqual({
            value: "{border.default}",
        });
    });

    it("should convert basic border object", () => {
        const result = convertBorderToken({
            color: "#000000",
            width: { value: 1, unit: "px" },
            style: "solid",
        });

        expect(result).toEqual({
            value: "1px solid #000000",
        });
    });

    it("should handle references in individual properties", () => {
        const result = convertBorderToken({
            color: "{color.primary}",
            width: "{spacing.hairline}",
            style: "{borderStyles.default}",
        });

        expect(result).toEqual({
            value: "{spacing.hairline} {borderStyles.default} {color.primary}",
        });
    });

    it("should handle custom stroke style objects", () => {
        const result = convertBorderToken({
            color: "#000000",
            width: { value: 1, unit: "px" },
            style: {
                dashArray: [
                    { value: 4, unit: "px" },
                    { value: 2, unit: "px" },
                ],
                lineCap: "round",
            },
        });

        expect(result).toEqual({
            value: "1px 4px 2px round #000000",
        });
    });
});
