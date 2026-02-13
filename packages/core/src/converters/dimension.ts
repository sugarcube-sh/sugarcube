import { isReference } from "../guards/token-guards.js";
import type { SimpleCSSProperties } from "../types/convert.ts";
import type { TokenValue } from "../types/tokens.js";

export function convertDimensionToken(value: TokenValue<"dimension">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value: value };
    }

    return {
        value: `${value.value}${value.unit}`,
    };
}
