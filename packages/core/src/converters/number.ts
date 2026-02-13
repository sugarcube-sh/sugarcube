import { isReference } from "../guards/token-guards.js";
import type { SimpleCSSProperties } from "../types/convert.js";
import type { TokenValue } from "../types/tokens.js";

export function convertNumberToken(value: TokenValue<"number">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }
    return {
        value,
    };
}
