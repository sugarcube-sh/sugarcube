import { convertColorToString } from "../color/color-conversion.js";
import { isDTCGColorValue } from "../color/color-validation.js";
import { isReference } from "../guards/token-guards.js";
import type { ConversionOptions, SimpleCSSProperties } from "../types/convert.js";
import type { DTCGColorValue } from "../types/dtcg-color.js";

export function convertColorToken(
    value: string | DTCGColorValue,
    options: ConversionOptions
): SimpleCSSProperties {
    if (typeof value === "string" && isReference(value)) {
        return { value };
    }

    const fallbackStrategy = options.colorFallbackStrategy;

    if (isDTCGColorValue(value)) {
        return convertDTCGColorToken(value, fallbackStrategy);
    }

    const result = convertColorToString(value, fallbackStrategy);
    if (result.success) {
        return { value: result.value };
    }

    // Return error info instead of falling back silently
    const valueStr = typeof value === "string" ? value : "DTCG color object";
    console.warn(`[sugarcube] Failed to convert color ${valueStr}: ${result.error}`);
    return { value: typeof value === "string" ? value : "#000000" };
}

function convertDTCGColorToken(
    dtcgColor: DTCGColorValue,
    fallbackStrategy: "native" | "polyfill"
): SimpleCSSProperties {
    const result = convertColorToString(dtcgColor, fallbackStrategy);
    if (!result.success) {
        // Return error info instead of falling back silently
        console.warn(`[sugarcube] Failed to convert DTCG color: ${result.error}`);
        return { value: "#000000" };
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
