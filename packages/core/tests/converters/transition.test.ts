import { describe, expect, it } from "vitest";
import { convertTransitionToken } from "../../src/converters/transition.js";

describe("convertTransition", () => {
    it("should handle reference values", () => {
        const result = convertTransitionToken("{transition.default}");
        expect(result).toEqual({
            value: "{transition.default}",
        });
    });

    it("should convert basic transition object", () => {
        const result = convertTransitionToken({
            duration: { value: 200, unit: "ms" },
            delay: { value: 0, unit: "ms" },
            timingFunction: [0.4, 0, 0.2, 1],
        });

        expect(result).toEqual({
            value: "200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        });
    });

    it("should handle non-zero delay", () => {
        const result = convertTransitionToken({
            duration: { value: 200, unit: "ms" },
            delay: { value: 100, unit: "ms" },
            timingFunction: [0.4, 0, 0.2, 1],
        });

        expect(result).toEqual({
            value: "200ms cubic-bezier(0.4, 0, 0.2, 1) 100ms",
        });
    });

    it("should handle references in properties", () => {
        const result = convertTransitionToken({
            duration: "{durations.medium}",
            timingFunction: "{easings.default}",
            delay: "{durations.short}",
        });

        expect(result).toEqual({
            value: "{durations.medium} {easings.default} {durations.short}",
        });
    });
});
