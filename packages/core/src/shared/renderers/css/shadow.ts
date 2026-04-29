import type { CSSRenderOptions, CSSShadowProperties } from "../../../types/render.js";
import type { ShadowObject, TokenValue } from "../../../types/tokens.js";
import { convertColorToString } from "../../color/color-conversion.js";
import { isDTCGColorValue } from "../../color/color-validation.js";
import { ErrorMessages } from "../../constants/error-messages.js";
import { isReference } from "../../guards.js";

function convertShadowColor(color: ShadowObject["color"], options: CSSRenderOptions): string {
    if (isReference(color)) {
        return color;
    }

    if (isDTCGColorValue(color)) {
        const result = convertColorToString(color, options.colorFallbackStrategy);
        if (!result.success) {
            throw new Error(ErrorMessages.CONVERT.COLOR_CONVERSION_FAILED(result.error));
        }
        return result.value;
    }

    return color;
}

function convertSingleShadow(shadow: ShadowObject, options: CSSRenderOptions): string {
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

    const color = convertShadowColor(shadow.color, options);

    return `${shadow.inset ? "inset " : ""}${offsetX} ${offsetY} ${blur} ${spread} ${color}`;
}

export function renderShadow(
    value: TokenValue<"shadow">,
    options: CSSRenderOptions
): CSSShadowProperties {
    if (isReference(value)) {
        return { value };
    }

    if (!Array.isArray(value)) {
        return { value: convertSingleShadow(value, options) };
    }

    return { value: value.map((shadow) => convertSingleShadow(shadow, options)).join(", ") };
}
