import { describe, expect, it } from "vitest";
import { fontWeightOptions, readFontWeight, writeFontWeight } from "../src/tokens/font-weight";

describe("readFontWeight", () => {
    it("reads a number as a number-shaped weight", () => {
        expect(readFontWeight(700)).toEqual({ weight: 700, shape: "number" });
    });

    it("reads a keyword to the weight it means", () => {
        expect(readFontWeight("bold")).toEqual({ weight: 700, shape: "keyword" });
    });

    it("reads the spellings that share a weight", () => {
        expect(readFontWeight("hairline")?.weight).toBe(100);
        expect(readFontWeight("regular")?.weight).toBe(400);
        expect(readFontWeight("demi-bold")?.weight).toBe(600);
    });

    it("is case insensitive, as the renderer is", () => {
        expect(readFontWeight("Bold")).toEqual({ weight: 700, shape: "keyword" });
    });

    it("does not find a weight in a name every object has", () => {
        expect(readFontWeight("constructor")).toBeUndefined();
        expect(readFontWeight("toString")).toBeUndefined();
    });

    it("has nothing to read in a reference or an unknown name", () => {
        expect(readFontWeight("{font.weight.bold}")).toBeUndefined();
        expect(readFontWeight("chunky")).toBeUndefined();
        expect(readFontWeight(undefined)).toBeUndefined();
        expect(readFontWeight({ value: 700 })).toBeUndefined();
    });
});

describe("writeFontWeight", () => {
    it("keeps a number-shaped token a number", () => {
        expect(writeFontWeight("number", 500)).toBe(500);
    });

    it("keeps a keyword-shaped token a keyword", () => {
        expect(writeFontWeight("keyword", 500)).toBe("medium");
    });

    it("writes one spelling per weight, whichever one was there", () => {
        const shape = readFontWeight("hairline")!.shape;
        expect(writeFontWeight(shape, 100)).toBe("thin");
    });
});

describe("fontWeightOptions", () => {
    it("offers one option per weight", () => {
        expect(fontWeightOptions(400).map((option) => option.value)).toEqual([
            "100",
            "200",
            "300",
            "400",
            "500",
            "600",
            "700",
            "800",
            "900",
            "950",
        ]);
    });

    it("adds a weight that sits between the steps, in order", () => {
        const values = fontWeightOptions(450).map((option) => option.value);
        expect(values).toContain("450");
        expect(values.indexOf("450")).toBe(values.indexOf("500") - 1);
    });

    it("names an off-step weight by its number", () => {
        const option = fontWeightOptions(450).find((o) => o.value === "450");
        expect(option).toEqual({ value: "450", label: "450", detail: "450" });
    });
});
