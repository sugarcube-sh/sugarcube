import { describe, expect, it } from "vitest";
import { convertDurationToken } from "../../src/converters/duration.js";

describe("convertDuration", () => {
    it("should handle reference values", () => {
        const result = convertDurationToken("{duration.quick}");
        expect(result).toEqual({
            value: "{duration.quick}",
        });
    });

    it("should handle duration values in milliseconds", () => {
        const result = convertDurationToken({
            value: 150,
            unit: "ms",
        });
        expect(result).toEqual({
            value: "150ms",
        });
    });

    it("should handle duration values in seconds", () => {
        const result = convertDurationToken({
            value: 1.5,
            unit: "s",
        });
        expect(result).toEqual({
            value: "1.5s",
        });
    });
});
