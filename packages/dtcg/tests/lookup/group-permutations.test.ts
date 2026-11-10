import { describe, expect, it } from "vitest";
import { groupPermutationsBy } from "../../src/index.js";
import { oneFile } from "../token-files.js";
import { twoModifiers } from "./two-modifiers.js";

const tokens = twoModifiers();
const inputsOf = (groups: readonly { permutations: { inputs: readonly object[] } }[]) =>
    groups.map(({ permutations }) => permutations.inputs);

describe("groupPermutationsBy", () => {
    it("runs the function in every permutation, and gives each result once with the permutations that gave it", () => {
        const groups = groupPermutationsBy(tokens, (p) => p.getToken("gap")?.resolved);

        expect(groups.map(({ result }) => result)).toStrictEqual([1, 3, 2]);
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
        const red = groupPermutationsBy(tokens, (p) => p.getToken("color.red"));
        const gap = groupPermutationsBy(tokens, (p) => p.getToken("gap"));

        expect(red).toHaveLength(1);
        expect(red[0]?.permutations).toHaveLength(4);
        expect(gap).toHaveLength(4);
    });

    it("puts lists together when they hold the same items in the same order", () => {
        const groups = groupPermutationsBy(tokens, (p) =>
            p.getDependents("color.red").map(({ path }) => path),
        );

        expect(groups.map(({ result }) => result)).toStrictEqual([
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
        const order = groupPermutationsBy(tokens, (p) =>
            p.input.mode === "dark" ? ["a", "b"] : ["b", "a"],
        );
        const length = groupPermutationsBy(tokens, (p) =>
            p.input.size === "large" ? [1, 2] : [1],
        );

        expect(order).toHaveLength(2);
        expect(length).toHaveLength(2);
    });

    it("keeps apart results that are equal but not the same object", () => {
        const groups = groupPermutationsBy(tokens, (p) => ({ size: p.input.size }));

        expect(groups).toHaveLength(4);
    });

    it("gives a permutation without the token its own result, undefined", () => {
        const groups = groupPermutationsBy(tokens, (p) => p.getToken("fade"));

        expect(groups.map(({ result }) => result === undefined)).toStrictEqual([true, false]);
        expect(groups[0]?.permutations.inputs).toStrictEqual([
            { mode: "light", size: "small" },
            { mode: "light", size: "large" },
        ]);
    });

    it("puts every permutation in exactly one group", () => {
        const groups = groupPermutationsBy(tokens, (p) => p.getToken("gap")?.resolved);
        const all = groups.flatMap(({ permutations }) => permutations);

        expect(all).toHaveLength(tokens.permutations.length);
        expect(new Set(all)).toStrictEqual(new Set(tokens.permutations));
    });

    it("gives the permutations of each group as a list that can say which they are", () => {
        const [, large] = groupPermutationsBy(tokens, (p) => p.getToken("gap")?.resolved);

        expect(large?.permutations.scope).toStrictEqual([{ size: ["large"] }]);
        expect(large?.permutations.select((p) => p.input.mode === "dark").inputs).toStrictEqual([
            { mode: "dark", size: "large" },
        ]);
    });

    it("gives one group for a token file, which has one permutation", () => {
        const file = oneFile({ gap: { $type: "number", $value: 1 } });

        expect(groupPermutationsBy(file, (p) => p.getToken("gap")?.resolved)).toStrictEqual([
            { result: 1, permutations: file.permutations },
        ]);
    });

    it("runs the function once in each permutation", () => {
        let asked = 0;
        groupPermutationsBy(tokens, () => asked++);

        expect(asked).toBe(4);
    });
});
