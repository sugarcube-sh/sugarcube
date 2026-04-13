import type { ConvertedToken } from "@sugarcube-sh/core";

/** Extract the display-ready CSS value from a token */
export function getCSSValue(token: ConvertedToken): string | null {
    const props = token.$cssProperties;
    if (!props) return null;
    if ("value" in props) return String(props.value);
    return null;
}

/** Check if a CSS value string is a color */
export function isColorValue(value: string): boolean {
    return (
        value.startsWith("#") ||
        value.startsWith("rgb") ||
        value.startsWith("hsl") ||
        value.startsWith("oklch") ||
        value.startsWith("oklab") ||
        value.startsWith("color(")
    );
}

/** Get the leaf name from a token's $path (last segment) */
export function getTokenName(token: ConvertedToken): string {
    const parts = token.$path.split(".");
    return parts.at(-1) ?? token.$path;
}

/** Check if a token has typography CSS properties (font-size, font-family, etc.) */
export function isTypographyToken(token: ConvertedToken): boolean {
    return token.$type === "typography" || "font-size" in token.$cssProperties;
}

/** Get typography CSS properties if present */
export function getTypographyProps(token: ConvertedToken): Record<string, string> | null {
    const props = token.$cssProperties;
    if (!("font-size" in props)) return null;
    const result: Record<string, string> = {};
    for (const key of [
        "font-family",
        "font-size",
        "font-weight",
        "letter-spacing",
        "line-height",
    ]) {
        if (key in props) result[key] = String((props as Record<string, unknown>)[key]);
    }
    return result;
}
