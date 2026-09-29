import type { JsonPath, TokenType, ValueError } from "../index.js";

const shapes: Partial<Record<TokenType, string>> = {
    color: "A color must be an object with a colorSpace and three components, or a reference to a color token.",
    dimension:
        'A dimension must be an object with a number value and a unit of "px" or "rem", or a reference to a dimension token.',
    duration:
        'A duration must be an object with a number value and a unit of "ms" or "s", or a reference to a duration token.',
    cubicBezier:
        "A cubic Bézier must be a list of four numbers, [x1, y1, x2, y2], or a reference to a cubicBezier token.",
    number: "A number must be a JSON number, or a reference to a number token.",
    fontFamily:
        "A font family must be a font name, a list of font names, or a reference to a fontFamily token.",
    fontWeight:
        'A font weight must be a number from 1 to 1000, a keyword such as "bold", or a reference to a fontWeight token.',
    border: "A border must be an object with a color, a width and a style, or a reference to a border token.",
    transition:
        "A transition must be an object with a duration, a delay and a timingFunction, or a reference to a transition token.",
    shadow: "A shadow must be an object with a color, offsetX, offsetY, blur and spread, a list of them, or a reference to a shadow token.",
    gradient:
        "A gradient must be a list of stops, each an object with a color and a position, or a reference to a gradient token.",
    strokeStyle:
        'A stroke style must be a keyword such as "solid", an object with a dashArray and a lineCap, or a reference to a strokeStyle token.',
};

export const valueErrorMessages = {
    "wrong-shape": (type: TokenType) => shapes[type] ?? `This is not a ${type} value.`,
    "unknown-property": (name: string, type: TokenType) =>
        `"${name}" is not a property of a ${type}.`,
    "missing-property": (name: string, type: TokenType) => `A ${type} needs "${name}".`,
    "not-a-number": (value: unknown) => `${JSON.stringify(value)} is not a number.`,
    "alias-not-allowed-here": (value: string) =>
        `${value} is a reference, which can only stand for a whole value. To use part of another token's value here, write a JSON Pointer instead, such as { "$ref": "#/font/brand/$value" }.`,
    "hex-string": (value: string) =>
        `"${value}" is a hex string. A color is an object, such as { "colorSpace": "srgb", "components": [1, 0, 0], "hex": "#ff0000" }.`,
    "unknown-color-space": (value: unknown) =>
        `${JSON.stringify(value)} is not a color space the specification defines.`,
    "not-three-components": () => "A color has exactly three components.",
    "component-not-a-number": (value: unknown) =>
        `${JSON.stringify(value)} is not a number or "none".`,
    "component-out-of-range": (value: number, min: number, max: number, maxExclusive: boolean) =>
        `${value} is outside the range ${min} to ${max}${maxExclusive ? ", not including " + max : ""}.`,
    "alpha-out-of-range": (value: number) => `${value} is outside the range 0 to 1.`,
    "hex-not-six-digits": (value: unknown) =>
        `${JSON.stringify(value)} is not a six-digit hex color, such as "#e11d48".`,
    "string-with-unit": (value: string, example: string) =>
        `"${value}" is a string. Write it as an object: ${example}.`,
    "not-four-numbers": () => "A cubic Bézier has exactly four numbers: [x1, y1, x2, y2].",
    "x-out-of-range": (value: number) =>
        `${value} is outside the range 0 to 1. The x values of a cubic Bézier, the first and third, must be from 0 to 1.`,
    "empty-font-list": () => "A list of font names needs at least one name.",
    "not-a-font-name": (value: unknown) =>
        `${JSON.stringify(value)} is not a font name. A font name is a string that is not empty.`,
    "unknown-stroke-style-keyword": (value: string, keywords: readonly string[]) =>
        `"${value}" is not a stroke style keyword. Use one of ${keywords.map((k) => `"${k}"`).join(", ")}.`,
    "dash-array-not-a-list": () =>
        'A dashArray is a list of lengths, such as [{ "value": 4, "unit": "px" }, { "value": 2, "unit": "px" }].',
    "empty-dash-array": () =>
        "A dashArray needs at least one length: the dashes and gaps to repeat along the line.",
    "unknown-line-cap": (value: unknown, lineCaps: readonly string[]) =>
        `${JSON.stringify(value)} is not a line cap. Use ${lineCaps.map((c) => `"${c}"`).join(", ")}.`,
    "no-shadows": () => "A list of shadows needs at least one shadow.",
    "no-gradient-stops": () => "A gradient needs at least one stop.",
    "not-a-boolean": (value: unknown) => `${JSON.stringify(value)} is not true or false.`,
    "font-weight-out-of-range": (value: number) => `${value} is outside the range 1 to 1000.`,
    "unknown-font-weight-keyword": (value: string) =>
        `"${value}" is not a font weight keyword the specification defines. Keywords are lower case, such as "bold" or "semi-bold".`,
    "unit-not-allowed": (unit: unknown, allowed: readonly string[]) =>
        `${JSON.stringify(unit)} is not a unit here. Use ${allowed.map((u) => `"${u}"`).join(" or ")}.`,
} as const;

export type ValueErrorCode = keyof typeof valueErrorMessages;

export function valueError<D extends ValueErrorCode>(
    path: JsonPath,
    detail: D,
    ...args: Parameters<(typeof valueErrorMessages)[D]>
): ValueError {
    const message = (valueErrorMessages[detail] as (...a: unknown[]) => string)(...args);
    return { kind: "invalid-value", path, message, detail };
}
