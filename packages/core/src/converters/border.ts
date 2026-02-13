import { isReference } from "../guards/token-guards.js";
import type { CSSBorderProperties } from "../types/convert.js";
import type { TokenValue } from "../types/tokens.js";
import { convertStrokeStyleToken } from "./stroke.js";

export function convertBorderToken(value: TokenValue<"border">): CSSBorderProperties {
    if (isReference(value)) {
        return { value };
    }
    const width = isReference(value.width)
        ? value.width
        : `${value.width.value}${value.width.unit}`;
    const color = isReference(value.color) ? value.color : value.color;
    const style =
        typeof value.style === "string" ? value.style : convertStrokeStyleToken(value.style).value;

    return { value: `${width} ${style} ${color}` };
}
