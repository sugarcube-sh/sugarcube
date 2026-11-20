import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { oneFile } from "../token-files.js";
import { twoModifierFiles } from "./two-modifiers.js";

describe("permutation.changedInput", () => {
    const tokens = readFromMemory({ files: twoModifierFiles });

    it("leaves out each modifier at its default", () => {
        expect(tokens.getPermutation({ mode: "dark" }).changedInput).toStrictEqual({
            mode: "dark",
        });
        expect(tokens.getPermutation({ mode: "dark", size: "large" }).changedInput).toStrictEqual({
            mode: "dark",
            size: "large",
        });
    });

    it("is empty for the default permutation, and for tokens with no modifiers", () => {
        expect(tokens.getPermutation().changedInput).toStrictEqual({});
        expect(
            oneFile({ n: { $type: "number", $value: 1 } }).getPermutation().changedInput,
        ).toStrictEqual({});
    });
});
