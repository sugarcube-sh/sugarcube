import { describe, expect, it } from "vitest";
import { type DesignTokens, readFromMemory } from "../../src/index.js";

const color = (r: number) => ({ $value: { colorSpace: "srgb", components: [r, 0, 0] } });

function read(tokens: unknown, modes = false): DesignTokens {
    const files: Record<string, string> = { "tokens.json": JSON.stringify(tokens) };
    if (!modes) return readFromMemory({ files });
    files["tokens.resolver.json"] = JSON.stringify({
        version: "2025.10",
        resolutionOrder: [
            { type: "set", name: "base", sources: [{ $ref: "tokens.json" }] },
            {
                type: "modifier",
                name: "mode",
                default: "light",
                contexts: { light: [], dark: [] },
            },
        ],
    });
    return readFromMemory({ files, entryFile: "tokens.resolver.json" });
}

const missing = (tokens: DesignTokens) =>
    tokens.diagnostics.filter(({ kind }) => kind === "missing-reference");

describe("a group's $extends to a group that isn't there", () => {
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
            "everywhere",
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
