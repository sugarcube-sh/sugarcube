import { describe, expect, it } from "vitest";
import { gridColumns } from "../src/components/controls/ColorGrid";
import type { PaletteRamp } from "../src/tokens/palettes";

const ramp = (palette: string, steps: string[]): PaletteRamp => ({
    path: `color.${palette}`,
    name: palette,
    steps: steps.map((step) => ({
        step,
        value: `color.${palette}.${step}`,
        css: `var(--color-${palette}-${step})`,
    })),
});

describe("gridColumns", () => {
    it("is the step count when palettes are uniform", () => {
        expect(
            gridColumns([
                ramp("neutral", ["50", "500", "950"]),
                ramp("pink", ["50", "500", "950"]),
            ]),
        ).toBe(3);
    });

    it("takes the longest ramp, so every swatch is the same size", () => {
        expect(
            gridColumns([ramp("neutral", ["50", "500", "950"]), ramp("pink", ["50", "950"])]),
        ).toBe(3);
    });

    it("is not widened by a standalone colour", () => {
        expect(gridColumns([ramp("neutral", ["50", "500", "950"]), ramp("white", ["white"])])).toBe(
            3,
        );
    });

    it("is zero when nothing resolved", () => {
        expect(gridColumns([ramp("neutral", [])])).toBe(0);
    });
});
