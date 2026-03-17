import { convertColorToString } from "../color/color-conversion.js";
import { isDTCGColorValue } from "../color/color-validation.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { isReference } from "../guards/token-guards.js";
import type { CSSGradientProperties, ConversionOptions } from "../types/convert.js";
import type { GradientStop, TokenValue } from "../types/tokens.js";

function convertGradientColor(color: GradientStop["color"], options: ConversionOptions): string {
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

// Clamp position to [0, 1] range as per DTCG spec
// https://www.designtokens.org/tr/2025.10/format/#gradient
function clampPosition(position: number): number {
    return Math.max(0, Math.min(1, position));
}

function convertGradientPosition(position: GradientStop["position"]): string {
    if (isReference(position)) {
        return `${position}%`;
    }
    return `${clampPosition(position) * 100}%`;
}

function convertSingleStop(stop: GradientStop, options: ConversionOptions): string {
    const color = convertGradientColor(stop.color, options);
    const position = convertGradientPosition(stop.position);
    return `${color} ${position}`;
}

// After resolution, gradient arrays can contain nested arrays from resolved
// gradient token references. This type represents that.
type ResolvedGradientArray = (GradientStop | ResolvedGradientArray)[];

// Flatten nested arrays from resolved gradient token references
// Per DTCG spec, gradient arrays can contain references to other gradient tokens,
// which resolve to arrays of stops that need to be flattened during conversion
function flattenStops(value: ResolvedGradientArray): GradientStop[] {
    const stops: GradientStop[] = [];

    for (const item of value) {
        if (Array.isArray(item)) {
            stops.push(...flattenStops(item));
        } else {
            stops.push(item);
        }
    }

    return stops;
}

export function convertGradientToken(
    value: TokenValue<"gradient">,
    options: ConversionOptions
): CSSGradientProperties {
    if (isReference(value)) {
        return { value };
    }

    const flattenedStops = flattenStops(value as unknown as ResolvedGradientArray);
    const stops = flattenedStops.map((stop) => convertSingleStop(stop, options));

    return {
        value: `linear-gradient(${stops.join(", ")})`,
    };
}
