import { describe, expect, it } from "vitest";
import { convertDimensionToken } from "../../src/converters/dimension.js";
import type { TokenValue } from "../../src/types/tokens.js";

describe("convertDimensionToken", () => {
    it("should handle reference values", () => {
        const reference = "{dimension.spacing.1}";
        const result = convertDimensionToken(reference);
        expect(result).toEqual({ value: reference });
    });

    it("should convert pixel values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 16,
            unit: "px",
        };
        const result = convertDimensionToken(dimension);
        expect(result).toEqual({ value: "16px" });
    });

    it("should convert rem values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 1.5,
            unit: "rem",
        };
        const result = convertDimensionToken(dimension);
        expect(result).toEqual({ value: "1.5rem" });
    });

    it("should handle decimal values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 0.75,
            unit: "rem",
        };
        const result = convertDimensionToken(dimension);
        expect(result).toEqual({ value: "0.75rem" });
    });

    it("should handle zero values", () => {
        const dimension: TokenValue<"dimension"> = {
            value: 0,
            unit: "px",
        };
        const result = convertDimensionToken(dimension);
        expect(result).toEqual({ value: "0px" });
    });
});
