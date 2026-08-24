import type { ScaleExtension } from "@sugarcube-sh/core/client";
import { describe, expect, it } from "vitest";
import { selectEffectiveScale, selectOriginalScale } from "../src/store/scale-state";
import type { ScaleEdit } from "../src/store/scale-types";
import { snapshot, tree } from "./fixtures";

const makeScale = (override: Partial<ScaleExtension> = {}): ScaleExtension =>
    ({
        mode: "exponential",
        base: {
            min: { value: 1, unit: "rem" },
            max: { value: 1.125, unit: "rem" },
        },
        ratio: { min: 1.2, max: 1.25 },
        steps: { negative: 2, positive: 5 },
        ...override,
    }) as ScaleExtension;

describe("selectOriginalScale", () => {
    it("returns the scale extension at the parent path from the live baseline", () => {
        const r = makeScale();
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

        expect(selectOriginalScale(s, "size.step")).toEqual(r);
    });

    it("returns null when no scale extension is authored at the parent path", () => {
        const s = snapshot({
            trees: [tree("size.json", { size: { step: {} } })],
        });
        expect(selectOriginalScale(s, "size.step")).toBeNull();
    });
});

describe("selectEffectiveScale", () => {
    const baseline = snapshot({
        trees: [
            tree("size.json", {
                size: {
                    step: {
                        $extensions: { "sh.sugarcube": { scale: makeScale() } },
                    },
                },
            }),
        ],
    });

    it("returns the user's edit when present", () => {
        const userEdit = makeScale({ ratio: { min: 1.5, max: 1.5 } });
        const edit: ScaleEdit = { kind: "scale", scale: userEdit };
        expect(selectEffectiveScale(baseline, edit, "size.step")).toEqual(userEdit);
    });

    it("falls back to the on-disk original when no edit is present", () => {
        expect(selectEffectiveScale(baseline, undefined, "size.step")).toEqual(makeScale());
    });

    it("falls back to the on-disk original when the edit is tokens-kind (mode mismatch)", () => {
        const edit: ScaleEdit = { kind: "tokens", base: 2 };
        expect(selectEffectiveScale(baseline, edit, "size.step")).toEqual(makeScale());
    });
});
