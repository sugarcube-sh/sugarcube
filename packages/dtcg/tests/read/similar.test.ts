import { describe, expect, it } from "vitest";
import { readFromMemory } from "../../src/index.js";
import { similarName } from "../../src/read/similar.js";

const close: [string, string[], string][] = [
    ["color.brnd", ["color.brand", "color.ink"], "color.brand"],
    ["color.brnad", ["color.brand", "color.ink"], "color.brand"],
    ["color.inc", ["color.ink", "color.line"], "color.ink"],
    ["colr.brand", ["color.brand", "space.sm"], "color.brand"],
    ["colour", ["color", "dimension"], "color"],
    ["defualt", ["contexts", "default", "description"], "default"],
];

const far: [string, string[]][] = [
    ["color.ink", ["color.text", "color.line"]],
    ["color.gone", ["color.line", "color.tone", "color.bone"]],
    ["banana", ["color", "dimension"]],
];

describe("similarName", () => {
    it.for(close)("finds %s close to %j: %s", ([wanted, candidates, found]) => {
        expect(similarName(wanted, candidates)).toBe(found);
    });

    it.for(far)("finds nothing close to %s among %j", ([wanted, candidates]) => {
        expect(similarName(wanted, candidates)).toBeUndefined();
    });
});

describe("a missing reference's similar name", () => {
    it("is never the token that holds the reference", () => {
        const tokens = {
            color: {
                $type: "color",
                line: { $value: "{color.lin}" },
            },
        };
        const doc = readFromMemory({ files: { "tokens.json": JSON.stringify(tokens) } });
        const [found] = doc.diagnostics;
        expect(found?.kind).toBe("missing-reference");
        expect(found?.detail).not.toHaveProperty("similar");
    });
});
