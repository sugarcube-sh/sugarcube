import type { SimpleCSSProperties } from "../../../types/render.js";
import type { TokenValue } from "../../../types/tokens.js";
import { isReference } from "../../guards.js";

export function renderDuration(value: TokenValue<"duration">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }

    return {
        value: `${value.value}${value.unit}`,
    };
}
