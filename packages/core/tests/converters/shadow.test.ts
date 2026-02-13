import { describe, expect, it } from "vitest";
import { convertShadowToken } from "../../src/converters/shadow.js";

describe("convertShadow", () => {
    it("should handle reference values", () => {
        const result = convertShadowToken("{shadows.default}");
        expect(result).toEqual({
            value: "{shadows.default}",
        });
    });

    it("should convert single shadow object", () => {
        const result = convertShadowToken({
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 2, unit: "px" },
            blur: { value: 4, unit: "px" },
            spread: { value: 0, unit: "px" },
            color: "#000000",
        });

        expect(result).toEqual({
            value: "0px 2px 4px 0px #000000",
        });
    });

    it("should handle inset shadows", () => {
        const result = convertShadowToken({
            offsetX: { value: 0, unit: "px" },
            offsetY: { value: 2, unit: "px" },
            blur: { value: 4, unit: "px" },
            spread: { value: 0, unit: "px" },
            color: "#000000",
            inset: true,
        });

        expect(result).toEqual({
            value: "inset 0px 2px 4px 0px #000000",
        });
    });

    it("should handle multiple shadows", () => {
        const result = convertShadowToken([
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
        ]);

        expect(result).toEqual({
            value: "inset 0px 2px 4px 0px #000000, 0px 4px 8px 0px rgba(0,0,0,0.2)",
        });
    });

    it("should handle references in properties", () => {
        const result = convertShadowToken({
            offsetX: "{spacing.none}",
            offsetY: "{spacing.small}",
            blur: "{spacing.medium}",
            spread: "{spacing.none}",
            color: "{color.shadow}",
        });

        expect(result).toEqual({
            value: "{spacing.none} {spacing.small} {spacing.medium} {spacing.none} {color.shadow}",
        });
    });
});
