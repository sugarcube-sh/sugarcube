import { describe, expect, it } from "vitest";
import { diffToFileEdits } from "../src/tokens/diff-to-edits";
import type { TokenDiffEntry } from "../src/tokens/types";

const FLUID = {
    min: { value: 0.5, unit: "rem" },
    max: { value: 1, unit: "rem" },
};

const SCALE = {
    mode: "exponential",
    base: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
    ratio: { min: 1.2, max: 1.2 },
    steps: { negative: 0, positive: 3 },
};

function entry(overrides: Partial<TokenDiffEntry>): TokenDiffEntry {
    return {
        path: "space.md",
        sourcePath: "tokens.json",
        contexts: [],
        from: { $value: { value: 16, unit: "rem" } },
        to: { $value: { value: 20, unit: "rem" } },
        ...overrides,
    };
}

describe("diffToFileEdits", () => {
    it("emits a $value edit for a leaf-token change", () => {
        const result = diffToFileEdits([entry({})]);

        expect(result).toEqual([
            {
                path: "tokens.json",
                edits: [
                    {
                        jsonPath: ["space", "md", "$value"],
                        value: { value: 20, unit: "rem" },
                    },
                ],
            },
        ]);
    });

    it("emits both $value and fluid extension edits when present", () => {
        const result = diffToFileEdits([
            entry({
                to: {
                    $value: { value: 20, unit: "rem" },
                    $extensions: { "sh.sugarcube": { fluid: FLUID } },
                },
            }),
        ]);

        expect(result[0]?.edits).toEqual([
            { jsonPath: ["space", "md", "$value"], value: { value: 20, unit: "rem" } },
            { jsonPath: ["space", "md", "$extensions", "sh.sugarcube", "fluid"], value: FLUID },
        ]);
    });

    it("emits only the scale extension edit when there's no $value (group-level change)", () => {
        const result = diffToFileEdits([
            entry({
                path: "space",
                from: { $extensions: { "sh.sugarcube": { scale: SCALE } } },
                to: { $extensions: { "sh.sugarcube": { scale: SCALE } } },
            }),
        ]);

        expect(result[0]?.edits).toEqual([
            { jsonPath: ["space", "$extensions", "sh.sugarcube", "scale"], value: SCALE },
        ]);
    });

    it("groups edits from different paths under their source file", () => {
        const result = diffToFileEdits([
            entry({ path: "space.md", sourcePath: "space.json" }),
            entry({ path: "size.sm", sourcePath: "size.json" }),
            entry({ path: "space.lg", sourcePath: "space.json" }),
        ]);

        expect(result).toHaveLength(2);
        const space = result.find((f) => f.path === "space.json");
        const size = result.find((f) => f.path === "size.json");
        expect(space?.edits).toHaveLength(2);
        expect(size?.edits).toHaveLength(1);
    });

    it("skips the $value edit when $value is undefined", () => {
        const result = diffToFileEdits([
            entry({
                from: { $extensions: { "sh.sugarcube": { fluid: FLUID } } },
                to: { $extensions: { "sh.sugarcube": { fluid: FLUID } } },
            }),
        ]);

        expect(result[0]?.edits.every((e) => !e.jsonPath.includes("$value"))).toBe(true);
    });

    it("returns an empty array when given no entries", () => {
        expect(diffToFileEdits([])).toEqual([]);
    });
});
