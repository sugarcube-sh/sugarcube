/**
 * Verifies that the recipe overlay produces the dimension tokens for
 * each calculated step and merges them into the resolved map without
 * touching unrelated entries.
 */

import type { ScaleExtension } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { applyRecipeOverlay } from "../src/store/recipe-apply";
import { PathIndex } from "../src/tokens/path-index";
import { resolved } from "./fixtures";

const recipe: ScaleExtension = {
    mode: "exponential",
    viewport: { min: 320, max: 1440 },
    base: {
        min: { value: 1, unit: "rem" },
        max: { value: 1, unit: "rem" },
    },
    ratio: { min: 1.2, max: 1.2 },
    steps: { negative: 0, positive: 2 },
};

describe("applyRecipeOverlay", () => {
    it("writes calculated min/max into each step's fluid extension", () => {
        const before = resolved(
            { path: "size.step.0", value: { value: 0, unit: "rem" } },
            { path: "size.step.1", value: { value: 0, unit: "rem" } },
            { path: "size.step.2", value: { value: 0, unit: "rem" } }
        );
        const pathIndex = new PathIndex(before);

        const after = applyRecipeOverlay(before, recipe, "size.step", pathIndex, "default");

        const step0 = after["default::size.step.0"] as {
            $value: { value: number; unit: string };
            $extensions: { "sh.sugarcube": { fluid: unknown } };
        };
        expect(step0.$value).toEqual({ value: 1, unit: "rem" });
        expect(step0.$extensions["sh.sugarcube"].fluid).toEqual({
            min: { value: 1, unit: "rem" },
            max: { value: 1, unit: "rem" },
            viewport: { min: 320, max: 1440 },
        });

        // step.1 = base * 1.2^1 = 1.2
        const step1 = after["default::size.step.1"] as { $value: { value: number } };
        expect(step1.$value.value).toBeCloseTo(1.2, 4);
    });

    it("only touches entries in the matching context", () => {
        const before = resolved(
            { path: "size.step.0", value: { value: 0, unit: "rem" }, context: "light" },
            { path: "size.step.0", value: { value: 0, unit: "rem" }, context: "dark" }
        );
        const pathIndex = new PathIndex(before);

        const after = applyRecipeOverlay(before, recipe, "size.step", pathIndex, "light");

        expect((after["light::size.step.0"] as { $value: { value: number } }).$value.value).toBe(1);
        // dark untouched
        expect((after["dark::size.step.0"] as { $value: { value: number } }).$value.value).toBe(0);
    });

    it("preserves unrelated tokens", () => {
        const before = resolved(
            { path: "size.step.0", value: { value: 0, unit: "rem" } },
            { path: "color.bg", value: "#fff", type: "color" }
        );
        const pathIndex = new PathIndex(before);

        const after = applyRecipeOverlay(before, recipe, "size.step", pathIndex, "default");

        expect((after["default::color.bg"] as { $value: unknown }).$value).toBe("#fff");
    });

    it("returns a new resolved map (immutable)", () => {
        const before = resolved({ path: "size.step.0", value: { value: 0, unit: "rem" } });
        const pathIndex = new PathIndex(before);

        const after = applyRecipeOverlay(before, recipe, "size.step", pathIndex, "default");

        expect(after).not.toBe(before);
    });

    it("skips step paths that don't exist in the resolved map", () => {
        // Recipe wants steps 0..2 but only 0 exists in resolved.
        const before = resolved({ path: "size.step.0", value: { value: 0, unit: "rem" } });
        const pathIndex = new PathIndex(before);

        const after = applyRecipeOverlay(before, recipe, "size.step", pathIndex, "default");

        expect(Object.keys(after)).toEqual(["default::size.step.0"]);
    });
});
