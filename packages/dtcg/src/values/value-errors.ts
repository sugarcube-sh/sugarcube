import type { JsonPath, ValueError } from "../index.js";

export const valueErrorMessages = {
    "not-a-color": () =>
        "A color must be an object with a colorSpace and three components, or a reference to a color token.",
    "hex-string": (value: string) =>
        `"${value}" is a hex string. A color is an object, such as { "colorSpace": "srgb", "components": [1, 0, 0], "hex": "#ff0000" }.`,
    "unknown-property": (name: string) => `"${name}" is not a property of a color.`,
    "missing-property": (name: string) => `A color needs "${name}".`,
    "unknown-color-space": (value: unknown) =>
        `${JSON.stringify(value)} is not a color space the specification defines.`,
    "not-three-components": () => "A color has exactly three components.",
    "component-not-a-number": (value: unknown) =>
        `${JSON.stringify(value)} is not a number or "none".`,
    "component-out-of-range": (value: number, min: number, max: number, maxExclusive: boolean) =>
        `${value} is outside the range ${min} to ${max}${maxExclusive ? ", not including " + max : ""}.`,
    "alpha-not-a-number": (value: unknown) => `${JSON.stringify(value)} is not a number.`,
    "alpha-out-of-range": (value: number) => `${value} is outside the range 0 to 1.`,
    "hex-not-six-digits": (value: unknown) =>
        `${JSON.stringify(value)} is not a six-digit hex color, such as "#e11d48".`,
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
