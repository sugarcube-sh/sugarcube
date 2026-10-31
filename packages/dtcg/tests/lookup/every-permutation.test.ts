import { describe, expect, it } from "vitest";
import { everyPermutation, readFromMemory } from "../../src/index.js";
import { twoModifiers } from "./two-modifiers.js";

const tokens = twoModifiers();
const inputsOf = (groups: readonly { permutations: { inputs: readonly object[] } }[]) =>
    groups.map(({ permutations }) => permutations.inputs);

describe("everyPermutation", () => {
    it("asks every permutation, and gives each answer once with the permutations that gave it", () => {
        const groups = everyPermutation(tokens, (p) => p.token("gap")?.resolved);

        expect(groups.map(({ answer }) => answer)).toStrictEqual([1, 3, 2]);
        expect(inputsOf(groups)).toStrictEqual([
            [{ mode: "light", size: "small" }],
            [
                { mode: "light", size: "large" },
                { mode: "dark", size: "large" },
            ],
            [{ mode: "dark", size: "small" }],
        ]);
    });

    it("puts a token together where it is the same object, and apart where it differs", () => {
        const red = everyPermutation(tokens, (p) => p.token("color.red"));
        const gap = everyPermutation(tokens, (p) => p.token("gap"));

        expect(red).toHaveLength(1);
        expect(red[0]?.permutations).toHaveLength(4);
        expect(gap).toHaveLength(4);
    });

    it("puts lists together when they hold the same items in the same order", () => {
        const groups = everyPermutation(tokens, (p) =>
            p.usedBy("color.red").map(({ path }) => path),
        );

        expect(groups.map(({ answer }) => answer)).toStrictEqual([
            [],
            ["color.x"],
            ["color.x", "fade"],
        ]);
        expect(inputsOf(groups)[2]).toStrictEqual([
            { mode: "dark", size: "small" },
            { mode: "dark", size: "large" },
        ]);
    });

    it("keeps lists apart when their items differ, or come in another order", () => {
        const order = everyPermutation(tokens, (p) =>
            p.input.mode === "dark" ? ["a", "b"] : ["b", "a"],
        );
        const length = everyPermutation(tokens, (p) => (p.input.size === "large" ? [1, 2] : [1]));

        expect(order).toHaveLength(2);
        expect(length).toHaveLength(2);
    });

    it("keeps apart answers that are equal but not the same object", () => {
        const groups = everyPermutation(tokens, (p) => ({ size: p.input.size }));

        expect(groups).toHaveLength(4);
    });

    it("gives a permutation without the token its own answer, undefined", () => {
        const groups = everyPermutation(tokens, (p) => p.token("fade"));

        expect(groups.map(({ answer }) => answer === undefined)).toStrictEqual([true, false]);
        expect(groups[0]?.permutations.inputs).toStrictEqual([
            { mode: "light", size: "small" },
            { mode: "light", size: "large" },
        ]);
    });

    it("puts every permutation in exactly one answer", () => {
        const groups = everyPermutation(tokens, (p) => p.token("gap")?.resolved);
        const all = groups.flatMap(({ permutations }) => permutations);

        expect(all).toHaveLength(tokens.permutations.length);
        expect(new Set(all)).toStrictEqual(new Set(tokens.permutations));
    });

    it("gives the permutations of each answer as a list that can say which they are", () => {
        const [, large] = everyPermutation(tokens, (p) => p.token("gap")?.resolved);

        expect(large?.permutations.scope).toStrictEqual([{ size: ["large"] }]);
        expect(large?.permutations.where((p) => p.input.mode === "dark").inputs).toStrictEqual([
            { mode: "dark", size: "large" },
        ]);
    });

    it("gives one answer for a token file, which has one permutation", () => {
        const file = readFromMemory({
            files: { "tokens.json": JSON.stringify({ gap: { $type: "number", $value: 1 } }) },
        });

        expect(everyPermutation(file, (p) => p.token("gap")?.resolved)).toStrictEqual([
            { answer: 1, permutations: file.permutations },
        ]);
    });

    it("asks each permutation once", () => {
        let asked = 0;
        everyPermutation(tokens, () => asked++);

        expect(asked).toBe(4);
    });
});
