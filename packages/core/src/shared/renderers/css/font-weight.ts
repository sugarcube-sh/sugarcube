import type { SimpleCSSProperties } from "../../../types/render.js";
import type { TokenValue } from "../../../types/tokens.js";
import { FONT_WEIGHT_ALIASES } from "../../constants/tokens.js";
import { isReference } from "../../guards.js";

export function renderFontWeight(value: TokenValue<"fontWeight">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }

    if (typeof value === "number") {
        return { value };
    }

    return {
        value: Object.hasOwn(FONT_WEIGHT_ALIASES, value)
            ? (FONT_WEIGHT_ALIASES[value] as number)
            : value,
    };
}
