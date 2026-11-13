import type { StrokeStyleKeyword, StrokeStyleValue } from "../model/index.js";

/**
 * The font weight keywords the spec defines, each with its number.
 *
 * Some keywords mean the same weight, such as `normal`, `regular` and `book` for 400.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#font-weight | Format 8.4, Font weight}
 *
 * @example
 * // The number bold stands for
 * fontWeightKeywords.bold
 * // => 700
 */
export const fontWeightKeywords = {
    "thin": 100,
    "hairline": 100,
    "extra-light": 200,
    "ultra-light": 200,
    "light": 300,
    "normal": 400,
    "regular": 400,
    "book": 400,
    "medium": 500,
    "semi-bold": 600,
    "demi-bold": 600,
    "bold": 700,
    "extra-bold": 800,
    "ultra-bold": 800,
    "black": 900,
    "heavy": 900,
    "extra-black": 950,
    "ultra-black": 950,
} as const satisfies Readonly<Record<string, number>>;

/** A font weight keyword the spec defines, such as `"bold"`. */
export type FontWeightKeyword = keyof typeof fontWeightKeywords;

/** How a stroke style's dash ends are drawn, such as `"round"`. */
export type LineCap = Exclude<StrokeStyleValue, string>["lineCap"];

/**
 * The stroke style keywords the spec defines.
 *
 * They're `"solid"`, `"dashed"`, `"dotted"`, `"double"`, `"groove"`, `"ridge"`, `"outset"` and
 * `"inset"`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#stroke-style | Format 9.3, Stroke style}
 */
export const strokeStyleKeywords: readonly StrokeStyleKeyword[] = [
    "solid",
    "dashed",
    "dotted",
    "double",
    "groove",
    "ridge",
    "outset",
    "inset",
];

/**
 * Every way the end of a dash can be drawn.
 *
 * They're `"round"`, `"butt"` and `"square"`.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#stroke-style | Format 9.3, Stroke style}
 */
export const lineCaps: readonly LineCap[] = ["round", "butt", "square"];
