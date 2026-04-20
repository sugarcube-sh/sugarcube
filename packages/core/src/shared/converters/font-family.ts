import type { SimpleCSSProperties } from "../../types/convert.js";
import type { FontFamily } from "../../types/tokens.js";
import { isReference } from "../guards.js";
import { quoteFont } from "./quote-font.js";

export function convertFontFamilyToken(value: FontFamily): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }

    const formatted = Array.isArray(value)
        ? value.map((font) => quoteFont(font)).join(", ")
        : quoteFont(value);

    return {
        value: formatted,
    };
}
