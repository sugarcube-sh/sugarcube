import { describe, expect, it } from "vitest";
import { renderStrokeStyle } from "../../../src/shared/renderers/css/stroke.js";

describe("convertStrokeStyle", () => {
    it("should handle reference values", () => {
        const result = renderStrokeStyle("{stroke.solid}");
        expect(result).toEqual({
            value: "{stroke.solid}",
        });
    });

    it("should handle keyword values", () => {
        const result = renderStrokeStyle("solid");
        expect(result).toEqual({
            value: "solid",
        });
    });

    it("should convert custom stroke style objects", () => {
        const result = renderStrokeStyle({
            dashArray: [
                { value: 4, unit: "px" },
                { value: 2, unit: "px" },
            ],
            lineCap: "round",
        });

        expect(result).toEqual({
            value: "4px 2px round",
        });
    });

    it("should handle references in dash array", () => {
        const result = renderStrokeStyle({
            dashArray: ["{spacing.small}", "{spacing.medium}"],
            lineCap: "round",
        });

        expect(result).toEqual({
            value: "{spacing.small} {spacing.medium} round",
        });
    });
});
