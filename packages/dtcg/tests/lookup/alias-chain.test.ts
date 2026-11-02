import { describe, expect, it } from "vitest";
import { type Input, readFromMemory } from "../../src/index.js";

const color = (value: unknown) => ({ $type: "color", $value: value });
const red = { colorSpace: "srgb", components: [1, 0, 0] };

const resolver = {
    version: "2025.10",
    resolutionOrder: [
        { type: "set", name: "base", sources: [{ $ref: "base.json" }] },
        {
            type: "modifier",
            name: "theme",
            default: "light",
            contexts: { light: [], dark: [{ $ref: "dark.json" }] },
        },
    ],
};

const tokens = readFromMemory({
    files: {
        "tokens.resolver.json": JSON.stringify(resolver),
        "base.json": JSON.stringify({
            palette: { red: color(red), rose: color(red) },
            brand: color("{palette.red}"),
            text: color("{brand}"),
            pointed: color({ $ref: "#/brand/$value" }),
            whole: color({ $ref: "#/brand" }),
            part: color({ $ref: "#/line/$value/color" }),
            gone: color("{nowhere}"),
            ring: color("{loop}"),
            loop: color("{ring}"),
            line: {
                $type: "border",
                $value: { color: "{brand}", width: { value: 1, unit: "px" }, style: "solid" },
            },
        }),
        "dark.json": JSON.stringify({ brand: color("{palette.rose}") }),
    },
    entryFile: "tokens.resolver.json",
});

const aliasChain = (path: string, input?: Input) =>
    tokens
        .getPermutation(input)
        .getToken(path)
        ?.aliasChain.map((each) => each.path);

describe("a token's aliasChain", () => {
    it("follows whole-value references from the token to the one that holds a value", () => {
        expect(aliasChain("text")).toStrictEqual(["text", "brand", "palette.red"]);
    });

    it("follows each permutation's own references", () => {
        expect(aliasChain("text", { theme: "dark" })).toStrictEqual([
            "text",
            "brand",
            "palette.rose",
        ]);
        const dark = tokens.getPermutation({ theme: "dark" });
        const text = dark.getToken("text");
        expect(text?.aliasChain[1]).toBe(dark.getToken("brand"));
    });

    it("follows a pointer to a whole value, or to the token itself, as the read does", () => {
        expect(aliasChain("pointed")).toStrictEqual(["pointed", "brand", "palette.red"]);
        expect(aliasChain("whole")).toStrictEqual(["whole", "brand", "palette.red"]);
    });

    it("is the token alone when its value is not a whole reference: a composite holding one, a property-level reference", () => {
        expect(aliasChain("palette.red")).toStrictEqual(["palette.red"]);
        expect(aliasChain("line")).toStrictEqual(["line"]);
        expect(aliasChain("part")).toStrictEqual(["part"]);
    });

    it("stops at a reference to nothing, and at a loop, without repeating", () => {
        expect(aliasChain("gone")).toStrictEqual(["gone"]);
        expect(aliasChain("ring")).toStrictEqual(["ring", "loop"]);
    });
});
