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
    readonly typicalRange?: { readonly min: number; readonly max: number };
}

/**
 * Every color space the Color module defines, with each component's range.
 *
 * A component with no limit has `max: Infinity`, and its usual range in `typicalRange`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/color/#supported-color-spaces | Color 4.2, Supported color spaces}
 *
 * @example
 * // OKLCH chroma has no upper limit, but stays under 0.5 in practice
 * colorSpaces.oklch[1]
 * // => { name: "Chroma", min: 0, max: Infinity, typicalRange: { min: 0, max: 0.5 } }
 */
export const colorSpaces: Readonly<
    Record<ColorSpace, readonly [ColorComponentRange, ColorComponentRange, ColorComponentRange]>
> = {
    "srgb": [
        { name: "Red", min: 0, max: 1 },
        { name: "Green", min: 0, max: 1 },
        { name: "Blue", min: 0, max: 1 },
    ],
    "srgb-linear": [
        { name: "Red", min: 0, max: 1 },
        { name: "Green", min: 0, max: 1 },
        { name: "Blue", min: 0, max: 1 },
    ],
    "hsl": [
        { name: "Hue", min: 0, max: 360, maxExclusive: true },
        { name: "Saturation", min: 0, max: 100 },
        { name: "Lightness", min: 0, max: 100 },
    ],
    "hwb": [
        { name: "Hue", min: 0, max: 360, maxExclusive: true },
        { name: "Whiteness", min: 0, max: 100 },
        { name: "Blackness", min: 0, max: 100 },
    ],
    "lab": [
        { name: "Lightness", min: 0, max: 100 },
        { name: "A", min: -Infinity, max: Infinity, typicalRange: { min: -160, max: 160 } },
        { name: "B", min: -Infinity, max: Infinity, typicalRange: { min: -160, max: 160 } },
    ],
    "lch": [
        { name: "Lightness", min: 0, max: 100 },
        { name: "Chroma", min: 0, max: Infinity, typicalRange: { min: 0, max: 230 } },
        { name: "Hue", min: 0, max: 360, maxExclusive: true },
    ],
    "oklab": [
        { name: "Lightness", min: 0, max: 1 },
        { name: "A", min: -Infinity, max: Infinity, typicalRange: { min: -0.5, max: 0.5 } },
        { name: "B", min: -Infinity, max: Infinity, typicalRange: { min: -0.5, max: 0.5 } },
    ],
    "oklch": [
        { name: "Lightness", min: 0, max: 1 },
        { name: "Chroma", min: 0, max: Infinity, typicalRange: { min: 0, max: 0.5 } },
        { name: "Hue", min: 0, max: 360, maxExclusive: true },
    ],
    "display-p3": [
        { name: "Red", min: 0, max: 1 },
        { name: "Green", min: 0, max: 1 },
        { name: "Blue", min: 0, max: 1 },
    ],
    "a98-rgb": [
        { name: "Red", min: 0, max: 1 },
        { name: "Green", min: 0, max: 1 },
        { name: "Blue", min: 0, max: 1 },
    ],
    "prophoto-rgb": [
        { name: "Red", min: 0, max: 1 },
        { name: "Green", min: 0, max: 1 },
        { name: "Blue", min: 0, max: 1 },
    ],
    "rec2020": [
        { name: "Red", min: 0, max: 1 },
        { name: "Green", min: 0, max: 1 },
        { name: "Blue", min: 0, max: 1 },
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
