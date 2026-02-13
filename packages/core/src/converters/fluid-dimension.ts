import { isReference } from "../guards/token-guards.js";
import type { ConversionOptions, SimpleCSSProperties } from "../types/convert.js";
import type { Dimension, FluidDimension, TokenValue } from "../types/tokens.js";

function normalizeToPixels(value: Dimension, rootSize = 16): number {
    return value.unit === "px" ? value.value : value.value * rootSize;
}

function convertFluidDimension(
    value: FluidDimension,
    options: ConversionOptions
): SimpleCSSProperties {
    const { min, max } = value;
    const fluidConfig = options.fluidConfig;
    const rootSize = 16; // TODO: make this configurable??

    const minSize = normalizeToPixels(min, rootSize);
    const maxSize = normalizeToPixels(max, rootSize);
    const minViewport = fluidConfig.min;
    const maxViewport = fluidConfig.max;

    if (minSize === maxSize) {
        return {
            value: `${minSize / rootSize}rem`,
        };
    }

    const minSizeRem = minSize / rootSize;
    const maxSizeRem = maxSize / rootSize;
    const minViewportRem = minViewport / rootSize;
    const maxViewportRem = maxViewport / rootSize;

    const slope = (maxSizeRem - minSizeRem) / (maxViewportRem - minViewportRem);
    const intersection = -1 * minViewportRem * slope + minSizeRem;

    return {
        value: `clamp(${minSizeRem}rem, ${intersection.toFixed(2)}rem + ${(slope * 100).toFixed(
            2
        )}vw, ${maxSizeRem}rem)`,
    };
}

export function convertFluidDimensionToken(
    value: TokenValue<"fluidDimension">,
    options: ConversionOptions
): SimpleCSSProperties {
    if (isReference(value)) {
        return { value };
    }

    return convertFluidDimension(value, options);
}
