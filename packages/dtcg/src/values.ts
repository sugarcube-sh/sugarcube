import type {
    ColorSpace,
    DimensionValue,
    DurationValue,
    Parse,
    StrokeStyleValue,
    TokenType,
    WithAliases,
} from "./index.js";

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

/** The spec's font weight keywords and the numbers they stand for, such as `bold: 700`. */
export const fontWeightKeywords: Readonly<Record<string, number>> = {
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
};

/** The spec's stroke style keywords: `solid`, `dashed`, `dotted`, … */
export const strokeStyleKeywords: readonly Extract<
    StrokeStyleValue,
    { kind: "keyword" }
>["keyword"][] = ["solid", "dashed", "dotted", "double", "groove", "ridge", "outset", "inset"];

/** How the end of a dash can be drawn: `round`, `butt`, `square`. */
export const lineCaps: readonly ("round" | "butt" | "square")[] = ["round", "butt", "square"];

/** The units a dimension may use. */
export const dimensionUnits: readonly DimensionValue["unit"][] = ["px", "rem"];

/** The units a duration may use. */
export const durationUnits: readonly DurationValue["unit"][] = ["ms", "s"];

/**
 * Every color space the Color module defines, with the name and range of each channel, for
 * pickers and sliders. An unbounded channel has `max: Infinity` (and `min: -Infinity` where
 * it can go negative).
 *
 * @example
 * colorSpaces.oklch // [{ name: "L", min: 0, max: 1 }, { name: "C", min: 0, max: Infinity }, { name: "H", min: 0, max: 360 }]
 */
export const colorSpaces: Readonly<
    Record<ColorSpace, readonly [ColorChannel, ColorChannel, ColorChannel]>
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
        { name: "H", min: 0, max: 360 },
        { name: "S", min: 0, max: 100 },
        { name: "L", min: 0, max: 100 },
    ],
    "hwb": [
        { name: "H", min: 0, max: 360 },
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
        { name: "H", min: 0, max: 360 },
    ],
    "oklab": [
        { name: "L", min: 0, max: 1 },
        { name: "a", min: -Infinity, max: Infinity },
        { name: "b", min: -Infinity, max: Infinity },
    ],
    "oklch": [
        { name: "L", min: 0, max: 1 },
        { name: "C", min: 0, max: Infinity },
        { name: "H", min: 0, max: 360 },
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

/** One channel of a color space: its name and range. */
export interface ColorChannel {
    name: string;
    min: number;
    max: number;
}

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
export const parseColor: Parse<WithAliases<"color">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one dimension value. */
export const parseDimension: Parse<WithAliases<"dimension">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one duration value. */
export const parseDuration: Parse<WithAliases<"duration">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one cubic Bézier value. */
export const parseCubicBezier: Parse<WithAliases<"cubicBezier">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one number value. */
export const parseNumber: Parse<WithAliases<"number">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one font family value. A single name becomes a list of one. */
export const parseFontFamily: Parse<WithAliases<"fontFamily">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one font weight value. Keywords become their numbers. */
export const parseFontWeight: Parse<WithAliases<"fontWeight">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one stroke style value. */
export const parseStrokeStyle: Parse<WithAliases<"strokeStyle">> = () => {
    throw new Error("not implemented yet");
};
/**
 * Reads one border value. A part that is a reference is kept as an `Alias`, and checked
 * against its target when references are followed.
 *
 * @example
 * parseBorder({ color: "{color.brand}", width: { value: 1, unit: "px" }, style: "solid" }, [])
 * // { ok: true, value: { color: { alias: "color.brand" }, width: { value: 1, unit: "px" },
 * //   style: { kind: "keyword", keyword: "solid" } } }
 */
export const parseBorder: Parse<WithAliases<"border">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one shadow value. A single shadow becomes a list of one. */
export const parseShadow: Parse<WithAliases<"shadow">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one gradient value. */
export const parseGradient: Parse<WithAliases<"gradient">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one transition value. */
export const parseTransition: Parse<WithAliases<"transition">> = () => {
    throw new Error("not implemented yet");
};
/** Reads one typography value. */
export const parseTypography: Parse<WithAliases<"typography">> = () => {
    throw new Error("not implemented yet");
};
