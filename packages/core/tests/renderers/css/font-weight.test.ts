import { describe, expect, it } from "vitest";
import { renderFontWeight } from "../../../src/shared/renderers/css/font-weight.js";

describe("convertFontWeight", () => {
    it("should handle reference values", () => {
        const result = renderFontWeight("{typography.weight.bold}");
        expect(result).toEqual({
            value: "{typography.weight.bold}",
        });
    });

    it("should handle numeric weights", () => {
        const result = renderFontWeight(400);
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
            const result = renderFontWeight(input as string);
            expect(result).toEqual({
                value: expected,
            });
        }
    });

    it("does not read an Object.prototype member as an alias", () => {
        expect(renderFontWeight("constructor" as never)).toEqual({ value: "constructor" });
        expect(renderFontWeight("toString" as never)).toEqual({ value: "toString" });
    });

    it("should pass a wrong-case alias through rather than correcting it", () => {
        const result = renderFontWeight("BOLD");
        expect(result).toEqual({
            value: "BOLD",
        });
    });
});
