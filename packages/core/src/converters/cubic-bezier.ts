import { isReference } from "../guards/token-guards.js";
import type { SimpleCSSProperties } from "../types/convert.js";
import type { TokenValue } from "../types/tokens.js";

export function convertCubicBezierToken(value: TokenValue<"cubicBezier">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }
    return {
        value: `cubic-bezier(${value.join(", ")})`,
    };
}
