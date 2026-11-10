import { describe, expect, it } from "vitest";
import { type DesignTokens, readFromMemory } from "../../src/index.js";
import { lightDark } from "../token-files.js";

const color = (r: number) => ({ $value: { colorSpace: "srgb", components: [r, 0, 0] } });

function read(tokens: unknown, modes = false): DesignTokens {
    const files: Record<string, string> = { "tokens.json": JSON.stringify(tokens) };
    if (!modes) return readFromMemory({ files });
    files["tokens.resolver.json"] = lightDark(["tokens.json"], []);
    return readFromMemory({ files });
}

const missing = (tokens: DesignTokens) =>
    tokens.diagnostics.filter(({ kind }) => kind === "missing-reference");

describe("a group's $extends to a group that isn't there", () => {
    it("is never told it meant the top level, which nothing can extend", () => {
        const tokens = read({ g: { $extends: "{x}", a: { $type: "number", $value: 1 } } });
        expect(missing(tokens).map(({ detail }) => detail)).toStrictEqual([
            { ref: "x", from: ["g"] },
        ]);
    });

    it("is told the group it probably meant", () => {
        const tokens = read({
            color: { $type: "color", red: color(1) },
            brand: { $extends: "{colr}" },
        });
        expect(missing(tokens).map(({ message }) => message)).toStrictEqual([
            "`colr` does not exist; did you mean `color`?",
        ]);
    });

    it("is offered a group, never a token, since $extends names a group", () => {
        const tokens = read({
            color: { $type: "color", red: color(1) },
            colors: { $type: "color", $value: { colorSpace: "srgb", components: [0, 0, 0] } },
            brand: { $extends: "{colorz}" },
        });
        expect(missing(tokens).map(({ detail }) => detail)).toStrictEqual([
            { ref: "colorz", from: ["brand"], similar: "color" },
        ]);
    });

    it("is one problem, held in every permutation that reads it", () => {
        const tokens = read({ brand: { $extends: "{nowhere}" } }, true);
        expect(missing(tokens).map(({ permutations }) => permutations.label)).toStrictEqual([
            "every permutation",
        ]);
    });

    it("is the same problem as a value naming it, with the other place attached", () => {
        const tokens = read({
            brand: { $extends: "{nowhere}" },
            ink: { $type: "color", $value: "{nowhere}" },
        });
        const [problem, ...others] = missing(tokens);
        expect(others).toStrictEqual([]);
        expect(problem?.detail).toStrictEqual({ ref: "nowhere", from: ["brand", "ink"] });
        expect(problem?.relatedInformation?.map(({ path }) => path)).toStrictEqual(["ink"]);
    });
});
