import { isReference } from "../guards/token-guards.js";
import type { SimpleCSSProperties } from "../types/convert.js";
import type { TokenValue } from "../types/tokens.js";

const fontWeightAliases: Record<string, number> = {
    "thin": 100,
    "hairline": 100,
    "extra-light": 200,
    "ultra-light": 200,
    "light": 300,
    "normal": 400,
    "regular": 400,
    "book": 400,
    "medium": 500,
    "semi-bold": 600,
    "demi-bold": 600,
    "bold": 700,
    "extra-bold": 800,
    "ultra-bold": 800,
    "black": 900,
    "heavy": 900,
    "extra-black": 950,
    "ultra-black": 950,
};

export function convertFontWeightToken(value: TokenValue<"fontWeight">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }

    if (typeof value === "number") {
        return { value };
    }

    return { value: fontWeightAliases[value.toLowerCase()] ?? value };
}
