import type {
    ColorSpace,
    ColorValue,
    DimensionValue,
    DurationValue,
    IgnoredProperty,
    JsonPath,
    TokenType,
    ValueError,
} from "../model.js";
import { fontWeightKeywords } from "./keywords.js";

/** The facts each reason carries, beside `type` and `reason`. */
export interface ValueErrorFacts {
    /** The wrong kind of JSON, such as a number for a dimension. */
    "wrong-shape": {
        readonly value: unknown;
        /** The reference a plain-string token path was probably meant to be. */
        readonly reference?: string;
    };
    /** An object has a property its type does not define. */
    "unknown-property": { readonly property: string };
    /** A `$ref` has other properties beside it. A JSON Pointer must stand alone. */
    "pointer-not-alone": Record<never, never>;
    /** An object lacks a property its type needs. */
    "missing-property": { readonly property: string };
    /** A number is needed, and the value is not one. */
    "not-a-number": { readonly value: unknown };
    /**
     * A curly brace reference is inside a part, such as a dimension's `value`. Only a JSON Pointer
     * can go there.
     */
    "curly-brace-not-allowed-here": { readonly reference: string };
    /** A color is written as a hex string. Through `read`, this is `hex-string-color`. */
    "hex-string": {
        readonly value: string;
        /**
         * The color object it stands for, as a file would write it. It has `alpha` only when the
         * hex has alpha digits.
         */
        readonly asObject: Omit<ColorValue, "alpha"> & { readonly alpha?: number };
    };
    /** A color's `colorSpace` is not one the Color module defines. */
    "unknown-color-space": { readonly value: unknown };
    /** A color's `components` is not an array of three. */
    "not-three-components": { readonly value: unknown };
    /** A color component is neither a number nor `"none"`. */
    "component-not-a-number": { readonly value: unknown };
    /** A color component is outside its range, as `colorSpaces` gives it. */
    "component-out-of-range": {
        readonly value: number;
        readonly colorSpace: ColorSpace;
        /** The component's name in `colorSpaces`, such as `"Hue"`. */
        readonly component: string;
        readonly min: number;
        /** The upper limit. It's left out when there's none, since JSON can't write infinity. */
        readonly max?: number;
        /** Whether `max` itself is out of range, as for a hue. */
        readonly maxExclusive: boolean;
    };
    /** A color's `alpha` is outside 0 to 1. */
    "alpha-out-of-range": { readonly value: number };
    /** A color's `hex` is not six hex digits after a `#`. */
    "hex-not-six-digits": {
        readonly value: unknown;
        /** The same color in six digits, such as `#ff00aa` for `#f0a`. */
        readonly sixDigits?: string;
    };
    /**
     * A hex string with three or four digits. With `hexStringColors` on, a hex string needs six or
     * eight.
     */
    "short-hex-string": {
        readonly value: string;
        /** The six or eight digits it stands for. `#f0a` is `#ff00aa`, and `#f0a8` is `#ff00aa88`. */
        readonly expanded: string;
    };
    /** A dimension or duration is written as a string, such as `"16px"`. */
    "string-with-unit": {
        readonly value: string;
        /** The unit it's written with, such as `"px"`. */
        readonly unit: string;
        /** The units its type can have, such as `["px", "rem"]`. */
        readonly allowed: readonly string[];
        /**
         * The object it stands for, such as `{ value: 16, unit: "px" }`. It's there only when the
         * type allows the unit.
         */
        readonly asObject?: {
            readonly value: number;
            readonly unit: DimensionValue["unit"] | DurationValue["unit"];
        };
    };
    /** A cubic Bézier does not have four numbers. */
    "not-four-numbers": { readonly count: number };
    /** A cubic Bézier's `x1` or `x2` is outside 0 to 1. */
    "x-out-of-range": { readonly value: number; readonly coordinate: "x1" | "x2" };
    /** An array of font names is empty. */
    "empty-font-list": Record<never, never>;
    /** A font name is not a string, or is empty. */
    "not-a-font-name": { readonly value: unknown };
    /** A stroke style string is not one of its keywords. */
    "unknown-stroke-style-keyword": {
        readonly value: string;
        readonly keywords: readonly string[];
    };
    /** A stroke style's `dashArray` is not an array. */
    "dash-array-not-a-list": { readonly value: unknown };
    /** A stroke style's `dashArray` is empty. */
    "empty-dash-array": Record<never, never>;
    /** A stroke style's `lineCap` is not one of the line caps. */
    "unknown-line-cap": { readonly value: unknown; readonly lineCaps: readonly string[] };
    /** An array of shadows is empty. */
    "no-shadows": Record<never, never>;
    /** A gradient has no stops. */
    "no-gradient-stops": Record<never, never>;
    /** A shadow's `inset` is not `true` or `false`. */
    "not-a-boolean": { readonly value: unknown };
    /** A font weight number is outside 1 to 1000. */
    "font-weight-out-of-range": { readonly value: number };
    /** A font weight string isn't one of the spec's keywords. */
    "unknown-font-weight-keyword": { readonly value: string };
    /** A reference is written where only a literal value is accepted. */
    "reference-not-allowed": { readonly reference: string };
    /** A dimension or duration has a unit its type does not allow. */
    "unit-not-allowed": { readonly unit: unknown; readonly allowed: readonly string[] };
}

/**
 * Why a value couldn't be read, as a name such as `"unit-not-allowed"`.
 *
 * Check this in your code, not the message. A message's wording can change.
 */
export type ValueErrorCode = keyof ValueErrorFacts;

/**
 * Why a value couldn't be read, with the facts behind its message.
 *
 * Check `reason`, and TypeScript knows which facts are there. For part of a composite, `type` is
 * the part's type.
 *
 * @example
 * // A dimension written in ems
 * { type: "dimension", reason: "unit-not-allowed", unit: "em", allowed: ["px", "rem"] }
 */
export type ValueErrorDetail = {
    [R in ValueErrorCode]: { readonly type: TokenType; readonly reason: R } & ValueErrorFacts[R];
}[ValueErrorCode];

type DetailOf<R extends ValueErrorCode> = Extract<ValueErrorDetail, { reason: R }>;

const typeNames: Record<TokenType, string> = {
    color: "color",
    dimension: "dimension",
    duration: "duration",
    cubicBezier: "cubic Bézier",
    number: "number",
    fontFamily: "font family",
    fontWeight: "font weight",
    border: "border",
    transition: "transition",
    shadow: "shadow",
    gradient: "gradient",
    typography: "typography",
    strokeStyle: "stroke style",
};

function formatType(type: TokenType): string {
    return type === "typography" ? "a typography value" : `a ${typeNames[type]}`;
}

const expectedShapes: Record<TokenType, string> = {
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

function describeValue(value: unknown): string {
    if (typeof value === "string") return "a string";
    if (typeof value === "number") return "a number";
    if (Array.isArray(value)) return "a list";
    if (typeof value === "object" && value !== null) return "an object";
    return `\`${String(value)}\``;
}

export function didYouMean(similar: string | undefined): string | undefined {
    return similar === undefined ? undefined : `did you mean \`${similar}\`?`;
}

export function formatList(names: readonly string[], joiner: "or" | "and" = "or"): string {
    const quoted = names.map((name) => `\`${name}\``);
    const last = quoted.pop();
    return quoted.length === 0 ? (last ?? "") : `${quoted.join(", ")} ${joiner} ${last}`;
}

function formatRange(min: number, max: number | undefined, maxExclusive: boolean): string {
    if (max === undefined) return `use ${min} or more`;
    return maxExclusive ? `use ${min} up to, not including, ${max}` : `use ${min} to ${max}`;
}

function formatValueObject(object: { value: number; unit: string }): string {
    return `write \`{ "value": ${object.value}, "unit": ${JSON.stringify(object.unit)} }\``;
}

type Message<R extends ValueErrorCode> = (detail: DetailOf<R>) => string;
type Help<R extends ValueErrorCode> = (detail: DetailOf<R>) => string | undefined;

export const valueErrorMessages: { [R in ValueErrorCode]: Message<R> } = {
    "wrong-shape": ({ type, value }) => `${formatType(type)} can't be ${describeValue(value)}`,
    "unknown-property": ({ type, property }) =>
        `\`${property}\` is not a ${typeNames[type]} property`,
    "pointer-not-alone": () => "`$ref` can't have other properties beside it",
    "missing-property": ({ type, property }) => `${formatType(type)} needs \`${property}\``,
    "not-a-number": () => "not a number",
    "curly-brace-not-allowed-here": ({ reference }) => `\`${reference}\` can't go inside a value`,
    "hex-string": () => "a color can't be a hex string",
    "unknown-color-space": ({ value }) =>
        typeof value === "string"
            ? `\`${value}\` is not a color space`
            : "`colorSpace` must be a string",
    "not-three-components": ({ value }) =>
        Array.isArray(value) ? "a color needs three components" : "`components` must be a list",
    "component-not-a-number": () => 'a component must be a number or `"none"`',
    "component-out-of-range": ({ component }) => `\`${component}\` out of range`,
    "alpha-out-of-range": () => "alpha out of range",
    "hex-not-six-digits": () => "`hex` must have six digits",
    "short-hex-string": ({ expanded }) =>
        `a hex color needs ${expanded.length === 9 ? "eight" : "six"} digits`,
    "string-with-unit": ({ type, unit, asObject }) =>
        asObject === undefined
            ? `\`${unit}\` is not a ${typeNames[type]} unit`
            : `${formatType(type)} can't be a string`,
    "not-four-numbers": () => "a cubic Bézier needs four numbers",
    "x-out-of-range": ({ coordinate }) => `\`${coordinate}\` out of range`,
    "empty-font-list": () => "the font list is empty",
    "not-a-font-name": ({ value }) =>
        typeof value === "string" && value.trim() === ""
            ? "a font name can't be empty"
            : "a font name must be a string",
    "unknown-stroke-style-keyword": ({ value }) => `\`${value}\` is not a stroke style`,
    "dash-array-not-a-list": () => "`dashArray` must be a list",
    "empty-dash-array": () => "`dashArray` is empty",
    "unknown-line-cap": ({ value }) =>
        typeof value === "string" ? `\`${value}\` is not a line cap` : "`lineCap` must be a string",
    "no-shadows": () => "the shadow list is empty",
    "no-gradient-stops": () => "the gradient has no stops",
    "not-a-boolean": () => "not true or false",
    "font-weight-out-of-range": () => "font weight out of range",
    "unknown-font-weight-keyword": ({ value }) => `\`${value}\` is not a font weight`,
    "reference-not-allowed": () => "a reference isn't allowed here",
    "unit-not-allowed": ({ type, unit }) =>
        typeof unit === "string"
            ? `\`${unit}\` is not a ${typeNames[type]} unit`
            : "`unit` must be a string",
};

export const valueErrorHelp: { [R in ValueErrorCode]?: Help<R> } = {
    "wrong-shape": ({ type, reference }) =>
        didYouMean(reference) ?? `write ${expectedShapes[type]}`,
    "component-out-of-range": ({ min, max, maxExclusive }) => formatRange(min, max, maxExclusive),
    "alpha-out-of-range": () => formatRange(0, 1, false),
    "hex-not-six-digits": ({ sixDigits }) =>
        sixDigits === undefined ? undefined : `write \`${sixDigits}\``,
    "short-hex-string": ({ expanded }) => `write \`${expanded}\``,
    "string-with-unit": ({ allowed, asObject }) =>
        asObject === undefined ? `use ${formatList(allowed)}` : formatValueObject(asObject),
    "x-out-of-range": () => formatRange(0, 1, false),
    "unknown-stroke-style-keyword": ({ keywords }) => `use ${formatList(keywords)}`,
    "unknown-line-cap": ({ lineCaps }) => `use ${formatList(lineCaps)}`,
    "font-weight-out-of-range": () => formatRange(1, 1000, false),
    "unknown-font-weight-keyword": ({ value }) =>
        Object.hasOwn(fontWeightKeywords, value.toLowerCase())
            ? `write \`${value.toLowerCase()}\``
            : undefined,
    "unit-not-allowed": ({ allowed }) => `use ${formatList(allowed)}`,
};

export function valueErrorMessage(detail: ValueErrorDetail): string {
    return (valueErrorMessages[detail.reason] as (detail: ValueErrorDetail) => string)(detail);
}

export function valueErrorHelpText(detail: ValueErrorDetail): string | undefined {
    const help = valueErrorHelp[detail.reason] as
        | ((detail: ValueErrorDetail) => string | undefined)
        | undefined;
    return help?.(detail);
}

export function valueError(jsonPath: JsonPath, detail: ValueErrorDetail): ValueError {
    const help = valueErrorHelpText(detail);
    return {
        kind: "invalid-value",
        jsonPath,
        message: valueErrorMessage(detail),
        ...(help !== undefined && { help }),
        detail,
    };
}

export function ignoredMessage(type: TokenType, property: string): string {
    return `\`${property}\` is not a ${typeNames[type]} property`;
}

export function ignoredProperty(
    jsonPath: JsonPath,
    type: TokenType,
    property: string,
): IgnoredProperty {
    return {
        kind: "unknown-property",
        jsonPath,
        message: ignoredMessage(type, property),
        detail: { type, property },
    };
}
