import type { ColorSpace } from "../index.js";

/** One channel of a color space: its name and range. */
export interface ColorComponentRange {
    name: string;
    min: number;
    max: number;
    /** Whether `max` itself is outside the range, as for a hue, where 360 is 0 again. */
    maxExclusive?: boolean;
}

/**
 * Every color space the Color module defines, with the name and range of each channel, for
 * pickers and sliders. An unbounded channel has `max: Infinity` (and `min: -Infinity` where
 * it can go negative).
 *
 * @example
 * colorSpaces.oklch // [{ name: "L", min: 0, max: 1 }, { name: "C", min: 0, max: Infinity }, { name: "H", min: 0, max: 360, maxExclusive: true }]
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
        { name: "a", min: -Infinity, max: Infinity },
        { name: "b", min: -Infinity, max: Infinity },
    ],
    "lch": [
        { name: "L", min: 0, max: 100 },
        { name: "C", min: 0, max: Infinity },
        { name: "H", min: 0, max: 360, maxExclusive: true },
    ],
    "oklab": [
        { name: "L", min: 0, max: 1 },
        { name: "a", min: -Infinity, max: Infinity },
        { name: "b", min: -Infinity, max: Infinity },
    ],
    "oklch": [
        { name: "L", min: 0, max: 1 },
        { name: "C", min: 0, max: Infinity },
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
