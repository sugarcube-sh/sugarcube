import { describe, expect, it } from "vitest";
import { oneFile } from "../token-files.js";

const red = { colorSpace: "srgb", components: [1, 0, 0] };
const px = (value: number) => ({ value, unit: "px" });

const permutation = oneFile({
    color: {
        $type: "color",
        red: { $value: red },
        brand: { $value: "{color.red}" },
        text: { $value: "{color.brand}" },
    },
    lift: {
        $type: "shadow",
        $value: {
            color: "{color.red}",
            offsetX: px(0),
            offsetY: px(1),
            blur: px(2),
            spread: px(0),
        },
    },
}).getPermutation();

describe("what a token works out from itself", () => {
    it("is the same each time it is read, as the read gives everything else", () => {
        const text = permutation.getToken("color.text");
        const lift = permutation.getToken("lift");

        expect(text?.aliasChain).toBe(text?.aliasChain);
        expect(lift?.parts).toBe(lift?.parts);
        expect(lift?.parts).toBeDefined();
    });
});

describe("what a group works out from itself", () => {
    it("is the same each time it is read", () => {
        const color = permutation.getGroup("color");
        expect(color?.childTokens).toBe(color?.childTokens);
        expect(color?.tokens).toBe(color?.tokens);
        expect(color?.children).toBe(color?.children);
    });
});

describe("working it out", () => {
    it("leaves nothing on the token or group that a tool sees", () => {
        const text = permutation.getToken("color.text");
        const lift = permutation.getToken("lift");
        const color = permutation.getGroup("color");
        const before = [text, lift, color].map((each) => Object.keys(each ?? {}));
        void text?.aliasChain;
        void lift?.parts;
        void color?.childTokens;
        void color?.tokens;
        expect([text, lift, color].map((each) => Object.keys(each ?? {}))).toStrictEqual(before);
        expect(JSON.stringify(text)).not.toContain("aliasChain");
        expect(JSON.stringify(color)).not.toContain("childTokens");
    });
});
