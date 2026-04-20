import type { SimpleCSSProperties } from "../../types/convert.js";
import type { TokenValue } from "../../types/tokens.js";
import { isReference } from "../guards.js";

export function convertStrokeStyleToken(
    value: TokenValue<"strokeStyle">
): SimpleCSSProperties & { value: string } {
    if (isReference(value)) {
        return { value };
    }

    if (typeof value === "string") {
        return { value };
    }

    const dashArray = value.dashArray
        .map((dim) => (isReference(dim) ? dim : `${dim.value}${dim.unit}`))
        .join(" ");

    return {
        value: `${dashArray} ${value.lineCap}`,
    };
}
