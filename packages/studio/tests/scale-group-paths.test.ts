import type { TokenTree } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { scaleGroupPaths } from "../src/tokens/scale-extension";

const RECIPE = {
    mode: "multipliers",
    base: { min: { value: 1, unit: "rem" }, max: { value: 1.25, unit: "rem" } },
    multipliers: { sm: 0.5, md: 1, lg: 2 },
};

function tree(tokens: unknown): TokenTree {
    return { tokens, sourcePath: "tokens.json" } as unknown as TokenTree;
}

describe("scaleGroupPaths", () => {
    it("finds a recipe on a top-level group", () => {
        const trees = [
            tree({
                space: {
                    $extensions: { "sh.sugarcube": { scale: RECIPE } },
                    md: { $value: { value: 1, unit: "rem" } },
                },
            }),
        ];

        expect(scaleGroupPaths(trees)).toEqual(["space"]);
    });

    it("finds one nested a level down", () => {
        // The demo's shape: the recipe sits on `size.step`, not on `size`.
        const trees = [
            tree({
                size: {
                    step: {
                        "$extensions": { "sh.sugarcube": { scale: RECIPE } },
                        "0": { $value: { value: 1, unit: "rem" } },
                    },
                },
            }),
        ];

        expect(scaleGroupPaths(trees)).toEqual(["size.step"]);
    });

    it("lists a group once even when several context trees declare it", () => {
        const node = { $extensions: { "sh.sugarcube": { scale: RECIPE } } };

        expect(scaleGroupPaths([tree({ space: node }), tree({ space: node })])).toEqual(["space"]);
    });

    it("finds nothing in a document with no recipes", () => {
        // The fluid starter kit: every dimension hand-authored.
        const trees = [
            tree({
                space: {
                    xs: { $value: { value: 0.25, unit: "rem" } },
                    sm: { $value: { value: 0.5, unit: "rem" } },
                },
            }),
        ];

        expect(scaleGroupPaths(trees)).toEqual([]);
    });
});
