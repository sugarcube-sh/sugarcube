import { describe, expect, it } from "vitest";
import { isEqualJson } from "../../src/index.js";

describe("isEqualJson", () => {
    it("is true for the same JSON, with object keys in any order", () => {
        expect(isEqualJson({ a: 1, b: [true, null, "x"] }, { b: [true, null, "x"], a: 1 })).toBe(true);
        expect(isEqualJson("{color.red}", "{color.red}")).toBe(true);
    });

    it("is false for lists in another order, a key more or less, or another value", () => {
        expect(isEqualJson([1, 2], [2, 1])).toBe(false);
        expect(isEqualJson({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        expect(isEqualJson({ a: 1 }, { a: "1" })).toBe(false);
        expect(isEqualJson(null, {})).toBe(false);
    });

    it("compares numbers exactly, unlike isEquivalentValue", () => {
        expect(isEqualJson(0.1 + 0.2, 0.3)).toBe(false);
    });
});
