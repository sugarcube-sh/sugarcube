import { describe, expect, it } from "vitest";
import { type Permutation, type Permutations, everyPermutation } from "../../src/index.js";
import { twoModifierFiles, twoModifiers } from "./two-modifiers.js";

const tokens = twoModifiers();

function asked(question: (permutation: Permutation) => unknown): Permutations[] {
    return everyPermutation(tokens, question).map(({ permutations }) => permutations);
}

function inTheirOrder(permutations: Permutations): void {
    const positions = permutations.map((each) => tokens.permutations.indexOf(each));
    for (const [index, position] of positions.entries()) {
        expect(position).toBeGreaterThan(index === 0 ? -1 : positions[index - 1]!);
    }
}

describe("every answer's permutations, with two modifiers and files that overlap", () => {
    it("come once each, in the design tokens' order", () => {
        const larger = twoModifierFiles["large.json"].replace('"$value":3', '"$value":4');
        const changes = tokens.diff(twoModifiers({ "large.json": larger }));
        const answers = [
            ...tokens.writtenAt("gap").flatMap(({ readIn, winsIn }) => [readIn, winsIn]),
            ...tokens.writtenAt("color.x").flatMap(({ readIn, winsIn }) => [readIn, winsIn]),
            ...asked((p) => p.token("gap")?.resolved),
            ...asked((p) => p.token("color.x")),
            ...tokens.referencedBy("color.red").map(({ permutations }) => permutations),
            ...asked((p) => p.refersTo("color.x")),
            ...asked((p) => p.refersTo("fade")),
            ...asked((p) => p.usedBy("color.red")),
            ...tokens.diagnostics.flatMap(({ permutations }) =>
                permutations ? [permutations] : [],
            ),
            ...changes.map(({ permutations }) => permutations),
        ];
        expect(tokens.diagnostics.map(({ permutations }) => permutations?.label)).toStrictEqual([
            "size: large",
        ]);
        expect(changes.map(({ permutations }) => permutations.label)).toStrictEqual([
            "size: large",
        ]);
        for (const permutations of answers) inTheirOrder(permutations);
    });

    it("give places in the order first met, walking the permutations in their order", () => {
        const firstMet = [
            ...new Set(
                tokens.permutations.flatMap(
                    (permutation) =>
                        permutation.token("gap")?.writtenAt.map((place) => tokens.spanOf(place)) ??
                        [],
                ),
            ),
        ];
        expect(tokens.writtenAt("gap").map(({ span }) => span)).toStrictEqual(firstMet);
        expect(new Set(firstMet.map(({ file }) => file))).toStrictEqual(
            new Set(["base.json", "dark.json", "large.json"]),
        );
    });
});
