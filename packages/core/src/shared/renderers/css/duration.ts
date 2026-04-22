import type { SimpleCSSProperties } from "../../../types/convert.js";
import type { TokenValue } from "../../../types/tokens.js";
import { isReference } from "../../guards.js";

export function convertDurationToken(value: TokenValue<"duration">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }

    return {
        value: `${value.value}${value.unit}`,
    };
}
