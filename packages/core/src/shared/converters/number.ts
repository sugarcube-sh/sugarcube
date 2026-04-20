import type { SimpleCSSProperties } from "../../types/convert.js";
import type { TokenValue } from "../../types/tokens.js";
import { isReference } from "../guards.js";

export function convertNumberToken(value: TokenValue<"number">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }
    return {
        value,
    };
}
