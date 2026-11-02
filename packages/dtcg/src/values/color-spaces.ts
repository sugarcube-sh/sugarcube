import type { ColorSpace } from "../model.js";

/** One channel of a color space: its name and range. */
export interface ColorComponentRange {
    readonly name: string;
    readonly min: number;
    readonly max: number;
    /** Whether `max` itself is outside the range, as for a hue, where 360 is 0 again. */
    readonly maxExclusive?: boolean;
    /**
     * For a channel the Color module leaves unbounded, the range it says the channel keeps to in
     * practice, such as OKLCH chroma, which "in practice doesn't exceed 0.5": the range to give a
     * slider. Absent for a bounded channel, whose own `min` and `max` serve.
     */
    readonly inPractice?: { readonly min: number; readonly max: number };
}

/**
 * Every color space the Color module defines, with the name and range of each channel, for
 * pickers and sliders. An unbounded channel has `max: Infinity` (and `min: -Infinity` where
 * it can go negative), and the range the Color module gives it in practice as `inPractice`.
 *
 * @example
 * const [, chroma] = colorSpaces.oklch;
 * chroma.max          // Infinity
 * chroma.inPractice   // { min: 0, max: 0.5 }
 */
export const colorSpaces: Readonly<
    Record<ColorSpace, readonly [ColorComponentRange, ColorComponentRange, ColorComponentRange]>
> = {
    "srgb": [
        { name: "R", min: 0, max: 1 },
        { name: "G", min: 0, max: 1 },
        { name: "B", min: 0, max: 1 },
    ],
    "srgb-linear": [
        { name: "R", min: 0, max: 1 },
        { name: "G", min: 0, max: 1 },
        { name: "B", min: 0, max: 1 },
    ],
    "hsl": [
        { name: "H", min: 0, max: 360, maxExclusive: true },
        { name: "S", min: 0, max: 100 },
        { name: "L", min: 0, max: 100 },
    ],
    "hwb": [
        { name: "H", min: 0, max: 360, maxExclusive: true },
        { name: "W", min: 0, max: 100 },
        { name: "B", min: 0, max: 100 },
    ],
    "lab": [
        { name: "L", min: 0, max: 100 },
        { name: "a", min: -Infinity, max: Infinity, inPractice: { min: -160, max: 160 } },
        { name: "b", min: -Infinity, max: Infinity, inPractice: { min: -160, max: 160 } },
    ],
    "lch": [
        { name: "L", min: 0, max: 100 },
        { name: "C", min: 0, max: Infinity, inPractice: { min: 0, max: 230 } },
        { name: "H", min: 0, max: 360, maxExclusive: true },
    ],
    "oklab": [
        { name: "L", min: 0, max: 1 },
        { name: "a", min: -Infinity, max: Infinity, inPractice: { min: -0.5, max: 0.5 } },
        { name: "b", min: -Infinity, max: Infinity, inPractice: { min: -0.5, max: 0.5 } },
    ],
    "oklch": [
        { name: "L", min: 0, max: 1 },
        { name: "C", min: 0, max: Infinity, inPractice: { min: 0, max: 0.5 } },
        { name: "H", min: 0, max: 360, maxExclusive: true },
    ],
    "display-p3": [
        { name: "R", min: 0, max: 1 },
        { name: "G", min: 0, max: 1 },
        { name: "B", min: 0, max: 1 },
    ],
    "a98-rgb": [
        { name: "R", min: 0, max: 1 },
        { name: "G", min: 0, max: 1 },
        { name: "B", min: 0, max: 1 },
    ],
    "prophoto-rgb": [
        { name: "R", min: 0, max: 1 },
        { name: "G", min: 0, max: 1 },
        { name: "B", min: 0, max: 1 },
    ],
    "rec2020": [
        { name: "R", min: 0, max: 1 },
        { name: "G", min: 0, max: 1 },
        { name: "B", min: 0, max: 1 },
    ],
    "xyz-d65": [
        { name: "X", min: 0, max: 1 },
        { name: "Y", min: 0, max: 1 },
        { name: "Z", min: 0, max: 1 },
    ],
    "xyz-d50": [
        { name: "X", min: 0, max: 1 },
        { name: "Y", min: 0, max: 1 },
        { name: "Z", min: 0, max: 1 },
    ],
};
