import { isReference } from "../guards/token-guards.js";
import type { CSSShadowProperties } from "../types/convert.js";
import type { ShadowObject, TokenValue } from "../types/tokens.js";

function convertSingleShadow(shadow: ShadowObject): string {
    const offsetX = isReference(shadow.offsetX)
        ? shadow.offsetX
        : `${shadow.offsetX.value}${shadow.offsetX.unit}`;

    const offsetY = isReference(shadow.offsetY)
        ? shadow.offsetY
        : `${shadow.offsetY.value}${shadow.offsetY.unit}`;

    const blur = isReference(shadow.blur) ? shadow.blur : `${shadow.blur.value}${shadow.blur.unit}`;

    const spread = isReference(shadow.spread)
        ? shadow.spread
        : `${shadow.spread.value}${shadow.spread.unit}`;

    const color = isReference(shadow.color) ? shadow.color : shadow.color;

    return `${shadow.inset ? "inset " : ""}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
}

export function convertShadowToken(value: TokenValue<"shadow">): CSSShadowProperties {
    if (isReference(value)) {
        return { value };
    }

    if (!Array.isArray(value)) {
        return { value: convertSingleShadow(value) };
    }

    return { value: value.map(convertSingleShadow).join(", ") };
}
