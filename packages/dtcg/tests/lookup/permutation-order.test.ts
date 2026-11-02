import { describe, expect, it } from "vitest";
import { type Permutation, type Permutations, askEveryPermutation } from "../../src/index.js";
import { twoModifierFiles, twoModifiers } from "./two-modifiers.js";
import { getSpan } from "../../src/editor.js";

const tokens = twoModifiers();

function asked(question: (permutation: Permutation) => unknown): Permutations[] {
    return askEveryPermutation(tokens, question).map(({ permutations }) => permutations);
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
            ...tokens
                .getDefinitions("gap")
                .flatMap(({ permutations, winsIn }) => [permutations, winsIn]),
            ...tokens
                .getDefinitions("color.x")
                .flatMap(({ permutations, winsIn }) => [permutations, winsIn]),
            ...asked((p) => p.getToken("gap")?.resolved),
            ...asked((p) => p.getToken("color.x")),
            ...tokens.getReferencesTo("color.red").map(({ permutations }) => permutations),
            ...asked((p) => p.getDependencies("color.x")),
            ...asked((p) => p.getDependencies("fade")),
            ...asked((p) => p.getDependents("color.red")),
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
                        permutation
                            .getToken("gap")
                            ?.definitions.map((place) => getSpan(tokens, place)) ?? [],
                ),
            ),
        ];
        expect(tokens.getDefinitions("gap").map(({ span }) => span)).toStrictEqual(firstMet);
        expect(new Set(firstMet.map(({ file }) => file))).toStrictEqual(
            new Set(["base.json", "dark.json", "large.json"]),
        );
    });
});
