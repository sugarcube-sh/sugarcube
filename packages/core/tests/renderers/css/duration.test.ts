import { describe, expect, it } from "vitest";
import { renderDuration } from "../../../src/shared/renderers/css/duration.js";

describe("convertDuration", () => {
    it("should handle reference values", () => {
        const result = renderDuration("{duration.quick}");
        expect(result).toEqual({
            value: "{duration.quick}",
        });
    });

    it("should handle duration values in milliseconds", () => {
        const result = renderDuration({
            value: 150,
            unit: "ms",
        });
        expect(result).toEqual({
            value: "150ms",
        });
    });

    it("should handle duration values in seconds", () => {
        const result = renderDuration({
            value: 1.5,
            unit: "s",
        });
        expect(result).toEqual({
            value: "1.5s",
        });
    });
});
