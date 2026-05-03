/**
 * The load-bearing invariant for the post-save phantom-diff bug fix:
 * `selectOriginal` always reads from the live baseline, so after a save
 * lands and baseline updates, the "original" recipe naturally tracks
 * the new on-disk value — no stale capture to diverge from.
 */

import type { ScaleExtension } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { type RecipeSlot, selectEffective, selectOriginal } from "../src/store/recipe-state";
import { snapshot, tree } from "./fixtures";

const recipe = (override: Partial<ScaleExtension> = {}): ScaleExtension =>
    ({
        mode: "exponential",
        viewport: { min: 320, max: 1440 },
        base: {
            min: { value: 1, unit: "rem" },
            max: { value: 1.125, unit: "rem" },
        },
        ratio: { min: 1.2, max: 1.25 },
        steps: { negative: 2, positive: 5 },
        ...override,
    }) as ScaleExtension;

const slotFor = (parentPath: string, edits: ScaleExtension | null = null): RecipeSlot => ({
    bindingToken: `${parentPath}.*`,
    parentPath,
    sourcePath: "size.json",
    edits,
});

describe("selectOriginal", () => {
    it("returns the recipe at the parent path from the live baseline", () => {
        const r = recipe();
        const s = snapshot({
            trees: [
                tree("size.json", {
                    size: {
                        step: {
                            $extensions: { "sh.sugarcube": { scale: r } },
                        },
                    },
                }),
            ],
        });

        expect(selectOriginal(s, slotFor("size.step"))).toEqual(r);
    });

    it("returns null when no recipe is authored at the parent path", () => {
        const s = snapshot({
            trees: [tree("size.json", { size: { step: {} } })],
        });
        expect(selectOriginal(s, slotFor("size.step"))).toBeNull();
    });
});

describe("selectEffective", () => {
    const baseline = snapshot({
        trees: [
            tree("size.json", {
                size: {
                    step: {
                        $extensions: { "sh.sugarcube": { scale: recipe() } },
                    },
                },
            }),
        ],
    });

    it("returns the user's edit when slot.edits is non-null", () => {
        const userEdit = recipe({ ratio: { min: 1.5, max: 1.5 } });
        expect(selectEffective(baseline, slotFor("size.step", userEdit))).toEqual(userEdit);
    });

    it("falls back to the on-disk original when slot.edits is null", () => {
        expect(selectEffective(baseline, slotFor("size.step", null))).toEqual(recipe());
    });
});
