import type {
    ColorSpace,
    DimensionValue,
    DurationValue,
    IgnoredProperty,
    JsonPath,
    TokenType,
    ValueError,
} from "../index.js";
import { fontWeightKeywords } from "./keywords.js";

/** The facts each reason carries, beside `type` and `reason`. */
export interface ValueErrorFacts {
    /** The value is not the JSON its type is written as, such as a number for a dimension. */
    "wrong-shape": { value: unknown };
    /** An object has a property its type does not define. */
    "unknown-property": { property: string };
    /** A `$ref` has other properties beside it: a JSON Pointer stands alone. */
    "pointer-not-alone": Record<never, never>;
    /** An object lacks a property its type needs. */
    "missing-property": { property: string };
    /** A number is needed, and the value is not one. */
    "not-a-number": { value: unknown };
    /** A `"{token}"` reference is written inside a value, where only a JSON Pointer can be. */
    "alias-not-allowed-here": { reference: string };
    /** A color is written as a hex string. Through `read`, this is `hex-string-color`. */
    "hex-string": { value: string };
    /** A color's `colorSpace` is not one the Color module defines. */
    "unknown-color-space": { value: unknown };
    /** A color's `components` is not a list of three. */
    "not-three-components": { value: unknown };
    /** A color component is neither a number nor `"none"`. */
    "component-not-a-number": { value: unknown };
    /** A color component is outside its channel's range, as `colorSpaces` gives it. */
    "component-out-of-range": {
        value: number;
        colorSpace: ColorSpace;
        /** The channel's name, such as `"H"`. */
        component: string;
        min: number;
        /** Left out when the channel has no upper limit, which JSON cannot write as a number. */
        max?: number;
        /** Whether `max` itself is outside the range, as for a hue. */
        maxExclusive: boolean;
    };
    /** A color's `alpha` is outside 0 to 1. */
    "alpha-out-of-range": { value: number };
    /** A color's `hex` is not six hex digits after a `#`. */
    "hex-not-six-digits": {
        value: unknown;
        /** A three-digit hex, such as `#f0a`, written with six digits: `#ff00aa`. */
        sixDigits?: string;
    };
    /** A dimension or duration is written as a string with its unit, such as `"16px"`. */
    "string-with-unit": {
        value: string;
        /** The object it stands for, `{ value: 16, unit: "px" }`, when its unit is one the type allows. */
        asObject?: { value: number; unit: DimensionValue["unit"] | DurationValue["unit"] };
    };
    /** A cubic Bézier does not have four numbers. */
    "not-four-numbers": { count: number };
    /** A cubic Bézier's `x1` or `x2` is outside 0 to 1. */
    "x-out-of-range": { value: number; coordinate: "x1" | "x2" };
    /** A list of font names is empty. */
    "empty-font-list": Record<never, never>;
    /** A font name is not a string, or is empty. */
    "not-a-font-name": { value: unknown };
    /** A stroke style string is not one of its keywords. */
    "unknown-stroke-style-keyword": { value: string; keywords: readonly string[] };
    /** A stroke style's `dashArray` is not a list. */
    "dash-array-not-a-list": { value: unknown };
    /** A stroke style's `dashArray` is empty. */
    "empty-dash-array": Record<never, never>;
    /** A stroke style's `lineCap` is not one of the line caps. */
    "unknown-line-cap": { value: unknown; lineCaps: readonly string[] };
    /** A list of shadows is empty. */
    "no-shadows": Record<never, never>;
    /** A gradient has no stops. */
    "no-gradient-stops": Record<never, never>;
    /** A shadow's `inset` is not `true` or `false`. */
    "not-a-boolean": { value: unknown };
    /** A font weight number is outside 1 to 1000. */
    "font-weight-out-of-range": { value: number };
    /** A font weight string is not one of the keywords the spec defines. */
    "unknown-font-weight-keyword": { value: string };
    /** A reference is written where only a literal value is accepted. */
    "reference-not-allowed": { reference: string };
    /** A dimension or duration has a unit its type does not allow. */
    "unit-not-allowed": { unit: unknown; allowed: readonly string[] };
}

/** Why a value could not be read, as a stable name to switch on, such as `"unit-not-allowed"`. */
export type ValueErrorCode = keyof ValueErrorFacts;

/**
 * Why a value could not be read, with the facts to word it: checking `reason` narrows to that
 * reason's facts. `type` is the type of the value that failed, which for a part of a composite,
 * such as a shadow's color, is the part's type.
 *
 * @example
 * { type: "dimension", reason: "unit-not-allowed", unit: "em", allowed: ["px", "rem"] }
 */
export type ValueErrorDetail = {
    [R in ValueErrorCode]: { type: TokenType; reason: R } & ValueErrorFacts[R];
}[ValueErrorCode];

type DetailOf<R extends ValueErrorCode> = Extract<ValueErrorDetail, { reason: R }>;

const typeWords: Record<TokenType, string> = {
    color: "a color",
    dimension: "a dimension",
    duration: "a duration",
    cubicBezier: "a cubic Bézier",
    number: "a number",
    fontFamily: "a font family",
    fontWeight: "a font weight",
    border: "a border",
    transition: "a transition",
    shadow: "a shadow",
    gradient: "a gradient",
    typography: "a typography value",
    strokeStyle: "a stroke style",
};

const shapes: Record<TokenType, string> = {
    color: "an object with `colorSpace` and `components`",
    dimension: "an object with a value and a unit",
    duration: "an object with a value and a unit",
    cubicBezier: "a list of four numbers",
    number: "a number",
    fontFamily: "a font name or a list of font names",
    fontWeight: "a number from 1 to 1000 or a keyword",
    border: "an object with `color`, `width` and `style`",
    transition: "an object with `duration`, `delay` and `timingFunction`",
    shadow: "an object with `color`, `offsetX`, `offsetY`, `blur` and `spread`, or a list of them",
    gradient: "a list of stops, each an object with `color` and `position`",
    typography:
        "an object with `fontFamily`, `fontSize`, `fontWeight`, `letterSpacing` and `lineHeight`",
    strokeStyle: "a keyword, or an object with `dashArray` and `lineCap`",
};

function found(value: unknown): string {
    if (typeof value === "string") {
        return value === "" ? "an empty string" : `the string \`${value}\``;
    }
    if (typeof value === "number") return `the number \`${value}\``;
    if (Array.isArray(value)) return "a list";
    if (typeof value === "object" && value !== null) return "an object";
    return `\`${String(value)}\``;
}

export function didYouMean(similar: string | undefined): string {
    return similar === undefined ? "" : `; did you mean \`${similar}\`?`;
}

function suchAs(object: ValueErrorFacts["string-with-unit"]["asObject"]): string {
    if (object === undefined) return "";
    return `, such as \`{ "value": ${object.value}, "unit": ${JSON.stringify(object.unit)} }\``;
}

function written(value: unknown): string {
    return typeof value === "string" && value !== "" ? `\`${value}\`` : found(value);
}

function listed(words: readonly string[]): string {
    const quoted = words.map((word) => `\`${word}\``);
    return quoted.length < 2
        ? quoted.join("")
        : `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
}

function range(min: number, max: number | undefined, maxExclusive: boolean): string {
    if (max === undefined) return `${min} or more`;
    return maxExclusive ? `from ${min} up to but not including ${max}` : `from ${min} to ${max}`;
}

export const valueErrorMessages: {
    [R in ValueErrorCode]: (detail: DetailOf<R>) => string;
} = {
    "wrong-shape": ({ type, value }) =>
        `${typeWords[type]} must be ${shapes[type]}, not ${found(value)}`,
    "unknown-property": ({ type, property }) =>
        `\`${property}\` is not a property of ${typeWords[type]}`,
    "pointer-not-alone": ({ type }) => `\`$ref\` is not a property of ${typeWords[type]}`,
    "missing-property": ({ type, property }) => `${typeWords[type]} needs \`${property}\``,
    "not-a-number": ({ value }) => `a number is needed, not ${found(value)}`,
    "alias-not-allowed-here": ({ reference }) =>
        `\`${reference}\` is a reference, which stands for a whole value and cannot be part of one`,
    "hex-string": ({ value }) => `\`${value}\` is a hex string, and a color must be an object`,
    "unknown-color-space": ({ value }) =>
        `${written(value)} is not a color space the specification defines`,
    "not-three-components": ({ value }) =>
        Array.isArray(value)
            ? `a color has three components, and this has ${value.length}`
            : `a color's components are a list of three, not ${found(value)}`,
    "component-not-a-number": ({ value }) =>
        `a component is a number or \`none\`, not ${found(value)}`,
    "component-out-of-range": ({ value, colorSpace, component, min, max, maxExclusive }) =>
        `\`${value}\` is out of range for \`${component}\` in \`${colorSpace}\`, which is ${range(min, max, maxExclusive)}`,
    "alpha-out-of-range": ({ value }) =>
        `\`${value}\` is out of range for alpha, which is from 0 to 1`,
    "hex-not-six-digits": ({ value, sixDigits }) =>
        `${written(value)} is not a six-digit hex color${didYouMean(sixDigits)}`,
    "string-with-unit": ({ type, value, asObject }) =>
        `\`${value}\` is a string, and ${typeWords[type]} must be an object with a value and a unit${suchAs(asObject)}`,
    "not-four-numbers": ({ count }) => `a cubic Bézier has four numbers, and this has ${count}`,
    "x-out-of-range": ({ value, coordinate }) =>
        `\`${value}\` is out of range for \`${coordinate}\`, which is from 0 to 1`,
    "empty-font-list": () => "a list of font names needs at least one name",
    "not-a-font-name": ({ value }) =>
        typeof value === "string" && value.trim() === ""
            ? "a font name cannot be empty"
            : `a font name is needed, not ${found(value)}`,
    "unknown-stroke-style-keyword": ({ value, keywords }) =>
        `\`${value}\` is not a stroke style keyword: the keywords are ${listed(keywords)}`,
    "dash-array-not-a-list": ({ value }) =>
        `a dash array is a list of lengths, not ${found(value)}`,
    "empty-dash-array": () => "a dash array needs at least one length",
    "unknown-line-cap": ({ value, lineCaps }) =>
        `${written(value)} is not a line cap: the line caps are ${listed(lineCaps)}`,
    "no-shadows": () => "a list of shadows needs at least one shadow",
    "no-gradient-stops": () => "a gradient needs at least one stop",
    "not-a-boolean": ({ value }) => `true or false is needed, not ${found(value)}`,
    "font-weight-out-of-range": ({ value }) =>
        `\`${value}\` is out of range for a font weight, which is from 1 to 1000`,
    "unknown-font-weight-keyword": ({ value }) =>
        Object.hasOwn(fontWeightKeywords, value.toLowerCase())
            ? `\`${value}\` is not a font weight keyword: keywords are lower case`
            : `\`${value}\` is not a font weight keyword the specification defines`,
    "reference-not-allowed": ({ reference }) =>
        `\`${reference}\` is a reference, and this needs the value itself`,
    "unit-not-allowed": ({ type, unit, allowed }) =>
        `${written(unit)} is not a unit ${typeWords[type]} can have: the units are ${listed(allowed)}`,
};

export function valueErrorMessage(detail: ValueErrorDetail): string {
    return (valueErrorMessages[detail.reason] as (detail: ValueErrorDetail) => string)(detail);
}

export function valueError(path: JsonPath, detail: ValueErrorDetail): ValueError {
    return { kind: "invalid-value", path, message: valueErrorMessage(detail), detail };
}

export function ignoredMessage(type: TokenType, property: string): string {
    return `\`${property}\` is not a property of ${typeWords[type]}, so it is ignored`;
}

export function ignoredProperty(
    path: JsonPath,
    type: TokenType,
    property: string,
): IgnoredProperty {
    return {
        kind: "unknown-property",
        path,
        message: ignoredMessage(type, property),
        detail: { type, property },
    };
}
