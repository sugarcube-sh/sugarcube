import type { DTCGColorValue } from "../../../types/dtcg-color.js";
import type { CSSRenderOptions, SimpleCSSProperties } from "../../../types/render.js";
import { convertColorToString } from "../../color/color-conversion.js";
import { isDTCGColorValue } from "../../color/color-validation.js";
import { ErrorMessages } from "../../constants/error-messages.js";
import { isReference } from "../../guards.js";

export function renderColor(
    value: string | DTCGColorValue,
    options: CSSRenderOptions
): SimpleCSSProperties {
    if (typeof value === "string" && isReference(value)) {
        return { value };
    }

    const fallbackStrategy = options.colorFallbackStrategy;

    if (isDTCGColorValue(value)) {
        return convertDTCGColorToken(value, fallbackStrategy);
    }

    const result = convertColorToString(value, fallbackStrategy);
    if (!result.success) {
        throw new Error(ErrorMessages.CONVERT.COLOR_CONVERSION_FAILED(result.error));
    }

    return { value: result.value };
}

function convertDTCGColorToken(
    dtcgColor: DTCGColorValue,
    fallbackStrategy: "native" | "polyfill"
): SimpleCSSProperties {
    const result = convertColorToString(dtcgColor, fallbackStrategy);
    if (!result.success) {
        throw new Error(ErrorMessages.CONVERT.COLOR_CONVERSION_FAILED(result.error));
    }

    const nativeColor = result.value;

    // Native mode: just output the color space directly
    if (fallbackStrategy === "native") {
        return { value: nativeColor };
    }

    // For universally supported color spaces (sRGB, HSL), polyfill mode acts like native mode
    if (dtcgColor.colorSpace === "srgb" || dtcgColor.colorSpace === "hsl") {
        return { value: nativeColor };
    }

    // Polyfill mode for modern color spaces: provide fallback + progressive enhancement
    if (!dtcgColor.hex) {
        throw new Error(
            `${dtcgColor.colorSpace} colors require a 'hex' fallback when using 'polyfill' strategy. Tip: Switch to 'native' strategy if targeting modern browsers only.`
        );
    }

    return {
        value: dtcgColor.hex,
        featureValues: [
            {
                query: getFeatureQuery(dtcgColor.colorSpace),
                value: nativeColor,
            },
        ],
    };
}

function getFeatureQuery(colorSpace: string): string {
    switch (colorSpace) {
        case "oklch":
            return "@supports (color: oklch(0 0 0))";
        case "display-p3":
            return "@supports (color: color(display-p3 1 1 1))";
        default:
            throw new Error(`No feature query defined for color space: ${colorSpace}`);
    }
}
