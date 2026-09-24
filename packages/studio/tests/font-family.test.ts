import { describe, expect, it } from "vitest";
import { readFontFamily, writeFontFamily } from "../src/tokens/font-family";

describe("readFontFamily", () => {
    it("reads a single family", () => {
        expect(readFontFamily("Inter")).toEqual({ text: "Inter", list: false });
    });

    it("reads a stack as one line", () => {
        expect(readFontFamily(["Inter", "system-ui", "sans-serif"])).toEqual({
            text: "Inter, system-ui, sans-serif",
            list: true,
        });
    });

    it("has nothing to read in a reference or a non-family value", () => {
        expect(readFontFamily("{typography.font.body}")).toBeUndefined();
        expect(readFontFamily(["Inter", 400])).toBeUndefined();
        expect(readFontFamily(undefined)).toBeUndefined();
    });
});

describe("writeFontFamily", () => {
    it("keeps a single family a string", () => {
        expect(writeFontFamily("Inter", false)).toBe("Inter");
    });

    it("keeps a stack of one an array, where it was authored as one", () => {
        expect(writeFontFamily("Inter", true)).toEqual(["Inter"]);
    });

    it("promotes a string to an array once it has a fallback", () => {
        expect(writeFontFamily("Inter, sans-serif", false)).toEqual(["Inter", "sans-serif"]);
    });

    it("trims the spacing around the commas", () => {
        expect(writeFontFamily("  Inter ,system-ui  ", true)).toEqual(["Inter", "system-ui"]);
    });

    it("drops empty entries a trailing comma leaves behind", () => {
        expect(writeFontFamily("Inter, ", true)).toEqual(["Inter"]);
    });

    it("has nothing to write when the field is emptied", () => {
        expect(writeFontFamily("   ", true)).toBeUndefined();
        expect(writeFontFamily(",,", false)).toBeUndefined();
    });
});
