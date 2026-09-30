import type { TokenType } from "../index.js";

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

const names: ReadonlySet<string> = new Set(tokenTypes);

export function isTokenType(name: string): name is TokenType {
    return names.has(name);
}
