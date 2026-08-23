import { describe, expect, it } from "vitest";
import { colorValueToToken, directColor, readColorValue } from "../src/tokens/color-value";

const TOKENS: Record<string, unknown> = {
    "color.text.normal": "{color.neutral.text.normal}",
    "color.neutral.text.normal": "{color.neutral.900}",
    "color.neutral.900": "#111827",
    "color.pink.500": "#ec4899",
};

const read = (path: string) => TOKENS[path];

describe("readColorValue", () => {
    it("follows the chain to the terminal path and keeps the authored hop", () => {
        expect(readColorValue(TOKENS["color.text.normal"], read)).toEqual({
            authored: "color.neutral.text.normal",
            terminal: "color.neutral.900",
        });
    });

    it("reports a direct palette reference as its own terminal", () => {
        expect(readColorValue("{color.pink.500}", read)).toEqual(directColor("color.pink.500"));
    });

    it("has nothing to say about a literal - no reference means no swatch", () => {
        expect(readColorValue("#111827", read)).toBeUndefined();
        expect(readColorValue(undefined, read)).toBeUndefined();
    });
});

describe("the value a picker hands back", () => {
    it("reproduces the token it opened with, after a preview wrote over it", () => {
        const tokens = { ...TOKENS };
        const readFrom = (path: string) => tokens[path];

        const original = readColorValue(tokens["color.text.normal"], readFrom);
        if (!original) throw new Error("expected color.text.normal to hold a reference");

        tokens["color.text.normal"] = colorValueToToken(directColor("color.pink.500"));
        expect(tokens["color.text.normal"]).toBe("{color.pink.500}");

        tokens["color.text.normal"] = colorValueToToken(original);

        expect(tokens["color.text.normal"]).toBe(TOKENS["color.text.normal"]);
    });

    it("still resolves to the same swatch after that round trip", () => {
        const tokens = { ...TOKENS };
        const readFrom = (path: string) => tokens[path];

        const original = readColorValue(tokens["color.text.normal"], readFrom);
        if (!original) throw new Error("expected color.text.normal to hold a reference");

        tokens["color.text.normal"] = colorValueToToken(original);

        expect(readColorValue(tokens["color.text.normal"], readFrom)).toEqual(original);
    });
});
