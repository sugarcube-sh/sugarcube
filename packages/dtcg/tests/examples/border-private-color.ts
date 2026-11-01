// Writes a border as CSS when its color points at a private palette token (one not exported as a
// custom property). That one color is written as its value, and every other reference stays a CSS
// custom property. A pointer into part of another token's value has no custom property of its own,
// so it is written as its value too.
import { type DesignTokens, type Input } from "@sugarcube-sh/dtcg";
import { cssValue, cssCustomProperty } from "@sugarcube-sh/dtcg/css";

declare const tokens: DesignTokens;
declare const input: Input;
declare function isPrivateToken(t: { path: string }): boolean;

const border = tokens.permutation(input).token("border.card");
const css =
    border &&
    cssValue(border, {
        replacement: ({ token }) =>
            token && !isPrivateToken(token)
                ? { customProperty: cssCustomProperty(token.path) }
                : undefined,
    });
if (typeof css === "string") row(css);
