import type { ConvertedToken } from "../types/convert.js";
import type { Reference, TokenType } from "../types/tokens.js";

export function isReference<T extends TokenType>(value: unknown): value is Reference<T> {
    return typeof value === "string" && value.startsWith("{") && value.endsWith("}");
}

export function isCompositeToken(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    if (!("$value" in value)) return false;

    const tokenValue = (value as { $value: unknown }).$value;

    return (
        typeof tokenValue === "object" &&
        tokenValue !== null &&
        !Array.isArray(tokenValue) &&
        Object.keys(tokenValue).length > 0
    );
}

export function isTypographyToken(
    token: ConvertedToken<TokenType>
): token is ConvertedToken<"typography"> {
    return token.$type === "typography";
}

