import { convertColorToString } from "../color/color-conversion.js";
import { isDTCGColorValue } from "../color/color-validation.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { isReference } from "../guards/token-guards.js";
import type { CSSBorderProperties, ConversionOptions } from "../types/convert.js";
import type { TokenValue } from "../types/tokens.js";
import { convertStrokeStyleToken } from "./stroke.js";

function convertBorderColor(color: TokenValue<"color">, options: ConversionOptions): string {
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

export function convertBorderToken(
    value: TokenValue<"border">,
    options: ConversionOptions
): CSSBorderProperties {
    if (isReference(value)) {
        return { value };
    }
    const width = isReference(value.width)
        ? value.width
        : `${value.width.value}${value.width.unit}`;
    const color = convertBorderColor(value.color, options);
    const style =
        typeof value.style === "string" ? value.style : convertStrokeStyleToken(value.style).value;

    return { value: `${width} ${style} ${color}` };
}
