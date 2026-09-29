import type { JsonPath, TokenType, ValueError } from "../index.js";

const shapes: Partial<Record<TokenType, string>> = {
    color: "A color must be an object with a colorSpace and three components, or a reference to a color token.",
    dimension:
        'A dimension must be an object with a number value and a unit of "px" or "rem", or a reference to a dimension token.',
    duration:
        'A duration must be an object with a number value and a unit of "ms" or "s", or a reference to a duration token.',
};

export const valueErrorMessages = {
    "wrong-shape": (type: TokenType) => shapes[type] ?? `This is not a ${type} value.`,
    "unknown-property": (name: string, type: TokenType) =>
        `"${name}" is not a property of a ${type}.`,
    "missing-property": (name: string, type: TokenType) => `A ${type} needs "${name}".`,
    "not-a-number": (value: unknown) => `${JSON.stringify(value)} is not a number.`,
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
    "unit-not-allowed": (unit: unknown, allowed: readonly string[]) =>
        `${JSON.stringify(unit)} is not a unit here. Use ${allowed.map((u) => `"${u}"`).join(" or ")}.`,
} as const;

export type ValueErrorDetail = keyof typeof valueErrorMessages;

export function valueError<D extends ValueErrorDetail>(
    path: JsonPath,
    detail: D,
    ...args: Parameters<(typeof valueErrorMessages)[D]>
): ValueError {
    const message = (valueErrorMessages[detail] as (...a: unknown[]) => string)(...args);
    return { kind: "invalid-value", path, message, detail };
}
