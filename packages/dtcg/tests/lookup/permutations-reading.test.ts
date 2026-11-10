import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { lightDark, oneFile } from "../token-files.js";

const tokens = readFromMemory({
    files: {
        "tokens.resolver.json": lightDark(["base.json"], ["dark.json"]),
        "base.json": JSON.stringify({ size: { $type: "number", sm: { $value: 1 } } }),
        "dark.json": JSON.stringify({ size: { sm: { $value: 2 } } }),
    },
});

describe("tokens.getPermutationsReading", () => {
    it("gives the permutations that read a file", () => {
        expect(tokens.getPermutationsReading("dark.json").label).toBe("mode: dark");
        expect(tokens.getPermutationsReading("base.json").label).toBe("every permutation");
    });

    it("gives every permutation for the entry file", () => {
        expect(tokens.getPermutationsReading("tokens.resolver.json").label).toBe(
            "every permutation",
        );
    });

    it("gives no permutation for a file the read didn't use", () => {
        expect(tokens.getPermutationsReading("gone.json").label).toBe("no permutation");
    });

    it("gives the one permutation for a read of one file", () => {
        expect(oneFile({}).getPermutationsReading("tokens.json").label).toBe("every permutation");
    });
});
