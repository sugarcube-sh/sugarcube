import { isReference } from "../guards/token-guards.js";
import type { CSSTypographyProperties } from "../types/convert.js";
import type { TokenValue } from "../types/tokens.js";
import { quoteFont } from "../utils/quote-font.js";
import { convertFontWeightToken } from "./font-weight.js";

export function convertTypographyToken(value: TokenValue<"typography">): CSSTypographyProperties {
    if (isReference(value)) {
        return {
            "font-family": value,
            "font-size": value,
        };
    }

    const properties: CSSTypographyProperties = {
        "font-family": isReference(value.fontFamily)
            ? value.fontFamily
            : Array.isArray(value.fontFamily)
              ? value.fontFamily.map((font) => quoteFont(font)).join(", ")
              : quoteFont(value.fontFamily),
        "font-size": isReference(value.fontSize)
            ? value.fontSize
            : `${value.fontSize.value}${value.fontSize.unit}`,
    };

    if (value.fontWeight) {
        properties["font-weight"] = isReference(value.fontWeight)
            ? value.fontWeight
            : convertFontWeightToken(value.fontWeight).value;
    }

    if (value.letterSpacing) {
        properties["letter-spacing"] = isReference(value.letterSpacing)
            ? value.letterSpacing
            : `${value.letterSpacing.value}${value.letterSpacing.unit}`;
    }

    if (value.lineHeight) {
        properties["line-height"] = isReference(value.lineHeight)
            ? value.lineHeight
            : value.lineHeight;
    }

    return properties;
}
