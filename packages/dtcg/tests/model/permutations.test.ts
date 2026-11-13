import { describe, expect, it } from "vitest";
import { makePermutations } from "../../src/model/permutations.js";
import { twoModifiers } from "../lookup/two-modifiers.js";

const { permutations: all } = twoModifiers();

describe("makePermutations", () => {
    it("gives each permutation once, in the design tokens' order, whatever order it is handed", () => {
        const [first, second, third] = all;
        const given = [third!, first!, third!, second!];
        expect([...makePermutations(given, all)]).toStrictEqual([first, second, third]);
    });
});
