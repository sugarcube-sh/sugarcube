import type { CurlyBraceReference, JsonPointerReference, ParsedReference } from "./reference.js";

/**
 * A color space the Color module defines, such as `"srgb"`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/color/#supported-color-spaces | Color 4.2, Supported color spaces}
 */
export type ColorSpace =
    | "srgb"
    | "srgb-linear"
    | "hsl"
    | "hwb"
    | "lab"
    | "lch"
    | "oklab"
    | "oklch"
    | "display-p3"
    | "a98-rgb"
    | "prophoto-rgb"
    | "rec2020"
    | "xyz-d65"
    | "xyz-d50";

/**
 * One component of a color, or `"none"`.
 *
 * `"none"` means the component doesn't apply, or isn't given.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/color/#the-none-keyword | Color 4.1.1, The none keyword}
 */
export type ColorComponent = number | "none";

/**
 * A color, as the Color module writes it.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/color/#format | Color 4.1, Format}
 *
 * @example
 * // color.blue.500
 * light.getToken("color.blue.500")!.value
 * // => { colorSpace: "srgb", components: [0.2, 0.4, 0.8], alpha: 1 }
 */
export interface ColorValue {
    /** The color space the components are in, such as `"srgb"`. */
    readonly colorSpace: ColorSpace;
    /**
     * The three components, in the color space's order.
     *
     * For `"srgb"`, that's red, green and blue.
     */
    readonly components: readonly [ColorComponent, ColorComponent, ColorComponent];
    /**
     * How opaque the color is, from 0 to 1.
     *
     * @default 1
     */
    readonly alpha: number;
    /**
     * A six-digit hex fallback, such as `"#3366cc"`.
     *
     * It's for tools that can't use the color space.
     */
    readonly hex?: string;
}

/**
 * A length, such as `{ value: 16, unit: "px" }`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#dimension | Format 8.2, Dimension}
 */
export interface DimensionValue {
    readonly value: number;
    readonly unit: "px" | "rem";
}

/**
 * A length of time, such as `{ value: 200, unit: "ms" }`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#duration | Format 8.5, Duration}
 */
export interface DurationValue {
    readonly value: number;
    readonly unit: "ms" | "s";
}

/**
 * An easing curve's two control points, as `[x1, y1, x2, y2]`.
 *
 * Both x values are from 0 to 1.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#cubic-bezier | Format 8.6, Cubic Bézier}
 */
export type CubicBezierValue = readonly [number, number, number, number];

/**
 * Font names, the first choice first.
 *
 * A file can write one name as a string. It's read as an array of one.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#font-family | Format 8.3, Font family}
 */
export type FontFamilyValue = readonly string[];

/**
 * A font weight, from 1 to 1000.
 *
 * A keyword such as `"bold"` is read as its number, 700.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#font-weight | Format 8.4, Font weight}
 */
export type FontWeightValue = number;

/**
 * A plain number, such as a line height or an opacity.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#number | Format 8.7, Number}
 */
export type NumberValue = number;

/**
 * A stroke style keyword the spec defines, such as `"dashed"`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#stroke-style | Format 9.3, Stroke style}
 */
export type StrokeStyleKeyword =
    | "solid"
    | "dashed"
    | "dotted"
    | "double"
    | "groove"
    | "ridge"
    | "outset"
    | "inset";

/**
 * A line style.
 *
 * It's a keyword, such as `"dashed"`, or your own pattern of dashes and gaps. `typeof` tells them
 * apart.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#stroke-style | Format 9.3, Stroke style}
 */
export type StrokeStyleValue =
    | StrokeStyleKeyword
    | {
          /** The lengths of the dashes and gaps, one after the other. */
          readonly dashArray: readonly DimensionValue[];
          /** How the end of each dash is drawn. */
          readonly lineCap: "round" | "butt" | "square";
      };

/**
 * A border's color, width and line style.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#border | Format 9.4, Border}
 */
export interface BorderValue {
    readonly color: ColorValue;
    readonly width: DimensionValue;
    readonly style: StrokeStyleValue;
}

/** One shadow in a {@link ShadowValue}. */
export interface ShadowLayer {
    readonly color: ColorValue;
    readonly offsetX: DimensionValue;
    readonly offsetY: DimensionValue;
    readonly blur: DimensionValue;
    readonly spread: DimensionValue;
    /**
     * Draws the shadow inside the element.
     *
     * @default false
     */
    readonly inset: boolean;
}

/**
 * One or more shadows, drawn together.
 *
 * A file can write one shadow as an object. It's read as an array of one.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#shadow | Format 9.6, Shadow}
 */
export type ShadowValue = readonly ShadowLayer[];

/** One color stop in a gradient. */
export interface GradientStop {
    readonly color: ColorValue;
    /**
     * Where the stop is along the gradient, from 0 to 1.
     *
     * A value outside that range is read as 0 or 1.
     */
    readonly position: number;
}

/**
 * A gradient, as its color stops.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#gradient | Format 9.7, Gradient}
 */
export type GradientValue = readonly GradientStop[];

/**
 * A transition's duration, delay and easing.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#transition | Format 9.5, Transition}
 */
export interface TransitionValue {
    readonly duration: DurationValue;
    readonly delay: DurationValue;
    readonly timingFunction: CubicBezierValue;
}

/**
 * The font, size, weight, spacing and line height of text.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#typography | Format 9.8, Typography}
 */
export interface TypographyValue {
    readonly fontFamily: FontFamilyValue;
    readonly fontSize: DimensionValue;
    readonly fontWeight: FontWeightValue;
    readonly letterSpacing: DimensionValue;
    /** A multiple of the font size, such as `1.5`. */
    readonly lineHeight: NumberValue;
}

/**
 * Each token type's value.
 *
 * `ValueByType["dimension"]` is {@link DimensionValue}.
 */
export interface ValueByType {
    color: ColorValue;
    dimension: DimensionValue;
    duration: DurationValue;
    cubicBezier: CubicBezierValue;
    number: NumberValue;
    fontFamily: FontFamilyValue;
    fontWeight: FontWeightValue;
    strokeStyle: StrokeStyleValue;
    border: BorderValue;
    shadow: ShadowValue;
    gradient: GradientValue;
    transition: TransitionValue;
    typography: TypographyValue;
}

/**
 * A token type the spec defines, such as `"color"`.
 *
 * {@link tokenTypes} lists them all.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#types | Format 8, Types}
 */
export type TokenType = keyof ValueByType;

/** `V`, where the whole or any part can be a {@link JsonPointerReference}. */
export type WithPointers<V> =
    | JsonPointerReference
    | (V extends object ? { [K in keyof V]: WithPointers<V[K]> } : V);

/**
 * A value whose references aren't followed yet.
 *
 * The whole can be a {@link CurlyBraceReference}. The whole or any part can be a
 * {@link JsonPointerReference}.
 */
export type Unresolved<V> = CurlyBraceReference | WithPointers<V>;

/** A stroke style whose references aren't followed yet. */
export type UnresolvedStrokeStyle =
    | ParsedReference
    | StrokeStyleKeyword
    | {
          readonly dashArray: JsonPointerReference | readonly Unresolved<DimensionValue>[];
          readonly lineCap: JsonPointerReference | "round" | "butt" | "square";
      };

/**
 * Each token type's value, with references not followed yet.
 *
 * A curly brace reference can stand for the whole value, or a part that's a token type itself,
 * such as a border's `color`. A JSON Pointer can stand for any part.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#composite-types | Format 9, Composite types}
 */
export interface UnresolvedValueByType {
    color: Unresolved<ColorValue>;
    dimension: Unresolved<DimensionValue>;
    duration: Unresolved<DurationValue>;
    cubicBezier: Unresolved<CubicBezierValue>;
    number: Unresolved<NumberValue>;
    fontFamily: Unresolved<FontFamilyValue>;
    fontWeight: Unresolved<FontWeightValue>;
    strokeStyle: UnresolvedStrokeStyle;
    border:
        | ParsedReference
        | {
              readonly color: Unresolved<ColorValue>;
              readonly width: Unresolved<DimensionValue>;
              readonly style: UnresolvedStrokeStyle;
          };
    shadow:
        | ParsedReference
        | readonly (
              | ParsedReference
              | {
                    readonly color: Unresolved<ColorValue>;
                    readonly offsetX: Unresolved<DimensionValue>;
                    readonly offsetY: Unresolved<DimensionValue>;
                    readonly blur: Unresolved<DimensionValue>;
                    readonly spread: Unresolved<DimensionValue>;
                    readonly inset: JsonPointerReference | boolean;
                }
          )[];
    gradient:
        | ParsedReference
        | readonly (
              | ParsedReference
              | {
                    readonly color: Unresolved<ColorValue>;
                    readonly position: Unresolved<NumberValue>;
                }
          )[];
    transition:
        | ParsedReference
        | {
              readonly duration: Unresolved<DurationValue>;
              readonly delay: Unresolved<DurationValue>;
              readonly timingFunction: Unresolved<CubicBezierValue>;
          };
    typography:
        | ParsedReference
        | {
              readonly fontFamily: Unresolved<FontFamilyValue>;
              readonly fontSize: Unresolved<DimensionValue>;
              readonly fontWeight: Unresolved<FontWeightValue>;
              readonly letterSpacing: Unresolved<DimensionValue>;
              readonly lineHeight: Unresolved<NumberValue>;
          };
}

/**
 * A value of type `T`, with its references not followed yet.
 *
 * It's the type of {@link TokenBase.value | Token.value}.
 * {@link TokenBase.resolved | Token.resolved} has the references followed.
 *
 * @example
 * // color.primary in dark
 * dark.getToken("color.primary")!.value
 * // => { syntax: "curly-brace", path: "color.blue.300" }
 */
export type UnresolvedValue<T extends TokenType> = UnresolvedValueByType[T];
