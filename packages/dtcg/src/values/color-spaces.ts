import type { ColorSpace } from "../model.js";

/** One component of a color space, with the values it can take. */
export interface ColorComponentRange {
    readonly name: string;
    readonly min: number;
    readonly max: number;
    /**
     * Whether `max` itself is out of range.
     *
     * It's `true` for a hue, where 360 is the same as 0.
     */
    readonly maxExclusive?: boolean;
    /**
     * The range a component with no limit usually stays within.
     *
     * OKLCH chroma has no upper limit, but stays under 0.5 in practice.
     */
    readonly inPractice?: { readonly min: number; readonly max: number };
}

/**
 * Every color space the Color module defines, with each component's range.
 *
 * A component with no limit has `max: Infinity`, and its usual range in `inPractice`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/color/#supported-color-spaces | Color 4.2, Supported color spaces}
 *
 * @example
 * // OKLCH chroma has no upper limit, but stays under 0.5 in practice
 * colorSpaces.oklch[1]
 * // => { name: "C", min: 0, max: Infinity, inPractice: { min: 0, max: 0.5 } }
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
