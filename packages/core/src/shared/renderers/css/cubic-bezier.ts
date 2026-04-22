import type { SimpleCSSProperties } from "../../../types/render.js";
import type { TokenValue } from "../../../types/tokens.js";
import { isReference } from "../../guards.js";

export function renderCubicBezier(value: TokenValue<"cubicBezier">): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }
    return {
        value: `cubic-bezier(${value.join(", ")})`,
    };
}
