import { describe, expect, it } from "vitest";
import { getScaleExtension } from "../src/tokens/scale-extension";
import { tree } from "./fixtures";

const SCALE = {
    mode: "exponential" as const,
    base: { min: { value: 1, unit: "rem" }, max: { value: 1, unit: "rem" } },
    ratio: { min: 1.2, max: 1.2 },
    steps: { negative: 0, positive: 3 },
};

describe("getScaleExtension", () => {
    it("returns the extension when present at the given path", () => {
        const trees = [
            tree("size.json", {
                size: { step: { $extensions: { "sh.sugarcube": { scale: SCALE } } } },
            }),
        ];

        expect(getScaleExtension(trees, "size.step")).toEqual(SCALE);
    });

    it("returns undefined when the path doesn't exist", () => {
        const trees = [
            tree("size.json", {
                size: { step: { $extensions: { "sh.sugarcube": { scale: SCALE } } } },
            }),
        ];

        expect(getScaleExtension(trees, "color.primary")).toBeUndefined();
    });

    it("returns undefined when the path exists but has no scale extension", () => {
        const trees = [tree("color.json", { color: { primary: { $value: "#000" } } })];

        expect(getScaleExtension(trees, "color.primary")).toBeUndefined();
    });

    it("returns undefined when the scale extension's mode is not recognised", () => {
        const trees = [
            tree("size.json", {
                size: {
                    step: { $extensions: { "sh.sugarcube": { scale: { mode: "linear" } } } },
                },
            }),
        ];

        expect(getScaleExtension(trees, "size.step")).toBeUndefined();
    });

    it("walks every tree and returns the first matching extension", () => {
        const trees = [
            tree("a.json", { other: {} }),
            tree("b.json", {
                size: { step: { $extensions: { "sh.sugarcube": { scale: SCALE } } } },
            }),
        ];

        expect(getScaleExtension(trees, "size.step")).toEqual(SCALE);
    });

    it("returns undefined when the path traverses through a non-object segment", () => {
        const trees = [tree("size.json", { size: { step: "not-an-object" } })];

        expect(getScaleExtension(trees, "size.step.deep")).toBeUndefined();
    });
});
