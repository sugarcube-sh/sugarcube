import type { TokenType } from "../model/value.js";

/**
 * Every token type the spec defines, in the spec's order.
 *
 * @see {@link https://www.designtokens.org/TR/2025.10/format/#types | Format 8, Types} and {@link https://www.designtokens.org/TR/2025.10/format/#composite-types | 9, Composite types}
 */
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

const names: ReadonlySet<string> = new Set(tokenTypes);

export function isTokenType(name: string): name is TokenType {
    return names.has(name);
}
