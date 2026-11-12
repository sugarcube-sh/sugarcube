import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { getSpan } from "../../src/editor.js";

const text = JSON.stringify(
    {
        color: {
            $type: "color",
            red: { $value: { colorSpace: "srgb", components: [1, 0, 0] } },
            brand: { $value: "{color.red}" },
        },
    },
    null,
    2,
);
const tokens = readFromMemory({ files: { "tokens.json": text } });
const permutation = tokens.getPermutation();
const brand = permutation.getToken("color.brand");
const red = permutation.getToken("color.red");

const at = (span: { offset: number; length: number }) =>
    text.slice(span.offset, span.offset + span.length);

describe("getSpan", () => {
    it("gives where a place is written in this read's text", () => {
        const place = red?.winningDefinition;
        if (!place) throw new Error("color.red is not read");
        const span = getSpan(tokens, place);
        expect(span.file).toBe("tokens.json");
        expect(JSON.parse(at(span))).toStrictEqual({
            $value: { colorSpace: "srgb", components: [1, 0, 0] },
        });
    });

    it("gives where a reference is written", () => {
        const reference = brand?.references[0];
        if (!reference) throw new Error("color.brand writes no reference");
        expect(at(getSpan(tokens, reference))).toBe('"{color.red}"');
    });

    it("agrees with the places tokens.getDefinitions gives", () => {
        const place = brand?.winningDefinition;
        if (!place) throw new Error("color.brand is not read");
        expect(tokens.getDefinitions("color.brand").map(({ span }) => span)).toStrictEqual([
            getSpan(tokens, place),
        ]);
    });
});

describe("a place and a reference", () => {
    it("hold no position of their own, so they can outlive the text they were read from", () => {
        expect(brand?.winningDefinition).not.toHaveProperty("span");
        expect(brand?.references[0]).not.toHaveProperty("span");
    });

    it("still say which source writes them and what it writes", () => {
        expect(brand?.winningDefinition.source.file).toBe("tokens.json");
        expect(brand?.winningDefinition.json).toStrictEqual({ $value: "{color.red}" });
        expect(brand?.references[0]?.pointsToPath).toBe("color.red");
    });
});
