import { isReference } from "../guards/token-guards.js";
import type { SimpleCSSProperties } from "../types/convert.js";
import type { TokenValue } from "../types/tokens.js";

export function convertDurationToken(value: TokenValue<"duration">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }

    return {
        value: `${value.value}${value.unit}`,
    };
}
