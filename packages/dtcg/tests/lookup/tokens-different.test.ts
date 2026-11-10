import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { lightDark } from "../token-files.js";

const rgb = (red: number) => ({
    $type: "color",
    $value: { colorSpace: "srgb", components: [red, 0, 0] },
});

const tokens = readFromMemory({
    files: {
        "tokens.resolver.json": lightDark(["base.json"], ["dark.json"]),
        "base.json": JSON.stringify({
            color: {
                red: rgb(1),
                background: { $type: "color", $value: "{color.red}" },
                text: rgb(0),
            },
            button: { background: { $type: "color", $value: "{color.background}" } },
            space: { $type: "dimension", gap: { $value: { value: 8, unit: "px" } } },
        }),
        "dark.json": JSON.stringify({
            color: { background: rgb(0.2), text: rgb(0) },
            glow: rgb(0.5),
            space: { gap: { $value: { value: 8.0001, unit: "px" } } },
        }),
    },
});

const light = tokens.getPermutation({ mode: "light" });
const dark = tokens.getPermutation({ mode: "dark" });
const paths = (found: readonly { path: string }[]) => found.map(({ path }) => path);

describe("a permutation's getTokensDifferentFrom", () => {
    it("gives each token whose resolved value differs, and each token that refers to one", () => {
        expect(paths(dark.getTokensDifferentFrom(light))).toStrictEqual([
            "color.background",
            "button.background",
            "glow",
        ]);
    });

    it("gives this permutation's tokens, so their values are this permutation's", () => {
        const [background] = dark.getTokensDifferentFrom(light);
        expect(background).toBe(dark.getToken("color.background"));
    });

    it("leaves out a token written again with an equal value, or a value within rounding", () => {
        const found = paths(dark.getTokensDifferentFrom(light));
        expect(found).not.toContain("color.text");
        expect(found).not.toContain("space.gap");
    });

    it("gives a token only this permutation has, but not one only the other has", () => {
        expect(paths(dark.getTokensDifferentFrom(light))).toContain("glow");
        expect(paths(light.getTokensDifferentFrom(dark))).not.toContain("glow");
    });

    it("gives nothing against itself", () => {
        expect(dark.getTokensDifferentFrom(dark)).toStrictEqual([]);
    });
});
