// Writes a border as CSS when its color points at a private palette token (one not exported as a
// custom property). That one color is written as its value, and every other reference stays a CSS
// custom property. A pointer into part of another token's value has no custom property of its own,
// so it is written as its value too.
import { type DesignTokens, type Input } from "@sugarcube-sh/dtcg";
import { toCSSValue, toCustomPropertyName } from "@sugarcube-sh/dtcg/css";

declare const tokens: DesignTokens;
declare const input: Input;
declare function isPrivateToken(t: { path: string }): boolean;

const border = tokens.getPermutation(input).getToken("border.card");
const css =
    border &&
    toCSSValue(border, {
        replaceReference: ({ pointsToWholeToken }) =>
            pointsToWholeToken && !isPrivateToken(pointsToWholeToken)
                ? { customProperty: toCustomPropertyName(pointsToWholeToken.path) }
                : undefined,
    });
if (typeof css === "string") row(css);
