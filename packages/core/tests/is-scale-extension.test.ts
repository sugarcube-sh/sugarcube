import { describe, expect, it } from "vitest";
import { isScaleExtension } from "../src/shared/guards";

describe("isScaleExtension", () => {
    it("accepts an exponential scale config", () => {
        expect(isScaleExtension({ mode: "exponential" })).toBe(true);
    });

    it("accepts a multipliers scale config", () => {
        expect(isScaleExtension({ mode: "multipliers" })).toBe(true);
    });

    it("rejects an object without a mode", () => {
        expect(isScaleExtension({})).toBe(false);
        expect(isScaleExtension({ base: {}, steps: {} })).toBe(false);
    });

    it("rejects an object with an unknown mode", () => {
        expect(isScaleExtension({ mode: "linear" })).toBe(false);
        expect(isScaleExtension({ mode: "" })).toBe(false);
    });

    it("rejects non-object values", () => {
        expect(isScaleExtension(undefined)).toBe(false);
        expect(isScaleExtension(null)).toBe(false);
        expect(isScaleExtension("exponential")).toBe(false);
        expect(isScaleExtension(42)).toBe(false);
    });
});
