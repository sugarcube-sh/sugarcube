import { describe, expect, it } from "vitest";
import { readCubicBezier, writeCubicBezier } from "../src/tokens/cubic-bezier";

describe("readCubicBezier", () => {
    it("reads four numbers", () => {
        expect(readCubicBezier([0.16, 1, 0.3, 1])).toEqual([0.16, 1, 0.3, 1]);
    });

    it("refuses anything that is not four finite numbers", () => {
        expect(readCubicBezier([0.16, 1, 0.3])).toBeUndefined();
        expect(readCubicBezier([0.16, 1, 0.3, 1, 0])).toBeUndefined();
        expect(readCubicBezier([0.16, "1", 0.3, 1])).toBeUndefined();
        expect(readCubicBezier([0.16, Number.NaN, 0.3, 1])).toBeUndefined();
        expect(readCubicBezier("0.16, 1, 0.3, 1")).toBeUndefined();
        expect(readCubicBezier(undefined)).toBeUndefined();
    });
});

describe("writeCubicBezier", () => {
    it("parses four comma-separated numbers, spacing aside", () => {
        expect(writeCubicBezier("0.42, 0, 0.58, 1")).toEqual([0.42, 0, 0.58, 1]);
        expect(writeCubicBezier("0.42,0,0.58,1")).toEqual([0.42, 0, 0.58, 1]);
        expect(writeCubicBezier("  0.42 , 0 , 0.58 , 1  ")).toEqual([0.42, 0, 0.58, 1]);
    });

    it("refuses the wrong count or anything unparseable", () => {
        expect(writeCubicBezier("0.42, 0, 0.58")).toBeUndefined();
        expect(writeCubicBezier("0.42, 0, 0.58, 1, 1")).toBeUndefined();
        expect(writeCubicBezier("ease-out")).toBeUndefined();
        expect(writeCubicBezier("")).toBeUndefined();
    });

    // D-041: parsing decides whether this is four numbers. Whether those numbers
    // are a legal curve is core's, over the whole document.
    it("accepts any four numbers, leaving legality to validation", () => {
        expect(writeCubicBezier("-0.1, 0, 0.58, 1")).toEqual([-0.1, 0, 0.58, 1]);
        expect(writeCubicBezier("0.42, 0, 1.1, 1")).toEqual([0.42, 0, 1.1, 1]);
        expect(writeCubicBezier("0.42, -5, 0.58, 12")).toEqual([0.42, -5, 0.58, 12]);
    });
});
