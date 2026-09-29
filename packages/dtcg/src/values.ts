import type { Parse, TokenType, WithAliases } from "./index.js";
import { readBorder } from "./values/border.js";
import { readColor } from "./values/color.js";
import { readDimension } from "./values/dimension.js";
import { readDuration } from "./values/duration.js";
import { readCubicBezier } from "./values/cubic-bezier.js";
import { readNumber } from "./values/number.js";
import { readShadow } from "./values/shadow.js";
import { readStrokeStyle } from "./values/stroke-style.js";
import { readTransition } from "./values/transition.js";
import { readTypography } from "./values/typography.js";
import { readFontFamily } from "./values/font-family.js";
import { readFontWeight } from "./values/font-weight.js";
import { readGradient } from "./values/gradient.js";

export { colorSpaces, type ColorChannel } from "./values/color-spaces.js";
export { dimensionUnits, durationUnits } from "./values/units.js";
export {
    type FontWeightKeyword,
    type LineCap,
    fontWeightKeywords,
    lineCaps,
    strokeStyleKeywords,
} from "./values/keywords.js";

/** Every token type the specification defines, in its order. */
export const tokenTypes: readonly TokenType[] = [
    "color",
    "dimension",
    "fontFamily",
    "fontWeight",
    "duration",
    "cubicBezier",
    "number",
    "strokeStyle",
    "border",
    "transition",
    "shadow",
    "gradient",
    "typography",
];

/**
 * The parts of each composite type, and the type of each part, in the spec's order. For shadow
 * and gradient, these are the parts of one layer or one stop. Every part is required except a
 * shadow's `inset`, which defaults to `false`.
 *
 * @example
 * compositeParts.border // { color: "color", width: "dimension", style: "strokeStyle" }
 */
export const compositeParts = {
    border: { color: "color", width: "dimension", style: "strokeStyle" },
    transition: { duration: "duration", delay: "duration", timingFunction: "cubicBezier" },
    shadow: {
        color: "color",
        offsetX: "dimension",
        offsetY: "dimension",
        blur: "dimension",
        spread: "dimension",
        inset: "boolean",
    },
    gradient: { color: "color", position: "number" },
    typography: {
        fontFamily: "fontFamily",
        fontSize: "dimension",
        fontWeight: "fontWeight",
        letterSpacing: "dimension",
        lineHeight: "number",
    },
} as const satisfies Readonly<Record<string, Readonly<Record<string, TokenType | "boolean">>>>;

/**
 * Reads one color value. A reference to a whole token, written `"{color.brand}"`, is read as an
 * `Alias`. A JSON Pointer is read as a `Pointer`, and may stand in place of the whole value or any
 * part of it.
 *
 * @example
 * parseColor({ colorSpace: "srgb", components: [1, 0, 1] }, [])
 * // { ok: true, value: { colorSpace: "srgb", components: [1, 0, 1], alpha: 1 } }
 *
 * @example
 * parseColor("{color.brand}", [])
 * // { ok: true, value: { alias: "color.brand" } }
 */
export const parseColor: Parse<WithAliases<"color">> = readColor;
/** Reads one dimension value. */
export const parseDimension: Parse<WithAliases<"dimension">> = readDimension;
/** Reads one duration value. */
export const parseDuration: Parse<WithAliases<"duration">> = readDuration;
/** Reads one cubic Bézier value. */
export const parseCubicBezier: Parse<WithAliases<"cubicBezier">> = readCubicBezier;
/** Reads one number value. */
export const parseNumber: Parse<WithAliases<"number">> = readNumber;
/** Reads one font family value. A single name becomes a list of one. */
export const parseFontFamily: Parse<WithAliases<"fontFamily">> = readFontFamily;
/** Reads one font weight value. Keywords become their numbers. */
export const parseFontWeight: Parse<WithAliases<"fontWeight">> = readFontWeight;
/** Reads one stroke style value. */
export const parseStrokeStyle: Parse<WithAliases<"strokeStyle">> = readStrokeStyle;
/**
 * Reads one border value. A part that is a reference is kept as an `Alias`, and checked
 * against its target when references are followed.
 *
 * @example
 * parseBorder({ color: "{color.brand}", width: { value: 1, unit: "px" }, style: "solid" }, [])
 * // { ok: true, value: { color: { alias: "color.brand" }, width: { value: 1, unit: "px" },
 * //   style: { kind: "keyword", keyword: "solid" } } }
 */
export const parseBorder: Parse<WithAliases<"border">> = readBorder;
/** Reads one shadow value. A single shadow becomes a list of one. */
export const parseShadow: Parse<WithAliases<"shadow">> = readShadow;
/** Reads one gradient value. */
export const parseGradient: Parse<WithAliases<"gradient">> = readGradient;
/** Reads one transition value. */
export const parseTransition: Parse<WithAliases<"transition">> = readTransition;
/** Reads one typography value. */
export const parseTypography: Parse<WithAliases<"typography">> = readTypography;
