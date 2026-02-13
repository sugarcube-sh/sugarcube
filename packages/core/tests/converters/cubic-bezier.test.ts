import { describe, expect, it } from "vitest";
import { convertCubicBezierToken } from "../../src/converters/cubic-bezier.js";

describe("convertCubicBezier", () => {
    it("should handle reference values", () => {
        const result = convertCubicBezierToken("{animation.ease-in}");
        expect(result).toEqual({
            value: "{animation.ease-in}",
        });
    });

    it("should convert cubic bezier array to CSS function", () => {
        const result = convertCubicBezierToken([0.4, 0, 0.2, 1]);
        expect(result).toEqual({
            value: "cubic-bezier(0.4, 0, 0.2, 1)",
        });
    });
});
