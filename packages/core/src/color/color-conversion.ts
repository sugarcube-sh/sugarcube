import type { ColorFallbackStrategy } from "../types/config.js";
import type { Result } from "../types/result.js";
import { error, success } from "../types/result.js";
import type { DTCGColorValue } from "../types/dtcg-color.js";
import {
    formatDTCGColorToOKLCH,
    isDTCGColorValue,
    validateDTCGColorValue,
} from "./color-validation.js";

/**
 * Converts any color input (hex string or DTCG token color object) to a CSS color string.
 *
 * @param input - Either a hex string (e.g., "#ff0000") or DTCG token color object
 * @param fallbackStrategy - How to handle modern color spaces ("native" or "polyfill")
 * @returns Result containing CSS-compatible color string or error message
 */
export function convertColorToString(
    input: string | DTCGColorValue,
    fallbackStrategy: ColorFallbackStrategy = "native"
): Result<string> {
    if (isDTCGColorValue(input)) {
        return formatDTCGColorNative(input);
    }

    return success(input);
}

/**
 * Formats DTCG token color objects to their native CSS color string format.
 * Supports OKLCH, Display P3, sRGB, and HSL color spaces.
 *
 * @param dtcgColor - DTCG token color object with colorSpace, components, optional alpha
 * @returns Result containing native CSS color string or error message
 */
function formatDTCGColorNative(dtcgColor: DTCGColorValue): Result<string> {
    switch (dtcgColor.colorSpace) {
        case "oklch":
            return formatDTCGColorToOKLCH(dtcgColor);

        case "display-p3":
            return formatDTCGColorToP3(dtcgColor);

        case "srgb":
            return formatDTCGColorToRGB(dtcgColor);

        case "hsl":
            return formatDTCGColorToHSL(dtcgColor);

        default:
            return error(
                `Unsupported color space: ${dtcgColor.colorSpace}. Supported color spaces: oklch, display-p3, srgb, hsl.`
            );
    }
}

/**
 * Formats DTCG token color object to Display P3 CSS string format.
 *
 * @param dtcgColor - DTCG token color object with display-p3 colorSpace
 * @returns Result containing CSS color(display-p3 ...) string or error message
 */
function formatDTCGColorToP3(dtcgColor: DTCGColorValue): Result<string> {
    if (dtcgColor.colorSpace !== "display-p3") {
        return error(`Expected display-p3 color space, got: ${dtcgColor.colorSpace}`);
    }

    if (!Array.isArray(dtcgColor.components) || dtcgColor.components.length !== 3) {
        return error("Display P3 components must be an array of exactly 3 numbers [R, G, B]");
    }

    const [r, g, b] = dtcgColor.components;
    const alpha = dtcgColor.alpha;

    // Validate component ranges (0-1 for display-p3), skip validation for "none"
    if (r !== "none" && (r < 0 || r > 1)) {
        return error("Display P3 Red component must be between 0 and 1 or 'none'");
    }
    if (g !== "none" && (g < 0 || g > 1)) {
        return error("Display P3 Green component must be between 0 and 1 or 'none'");
    }
    if (b !== "none" && (b < 0 || b > 1)) {
        return error("Display P3 Blue component must be between 0 and 1 or 'none'");
    }

    if (alpha !== undefined && (alpha < 0 || alpha > 1)) {
        return error("Alpha must be between 0 and 1");
    }

    const formattedR = r === "none" ? "none" : Number(r.toFixed(4));
    const formattedG = g === "none" ? "none" : Number(g.toFixed(4));
    const formattedB = b === "none" ? "none" : Number(b.toFixed(4));

    if (alpha !== undefined && alpha !== 1) {
        const roundedAlpha = Number(alpha.toFixed(4));
        return success(
            `color(display-p3 ${formattedR} ${formattedG} ${formattedB} / ${roundedAlpha})`
        );
    }

    return success(`color(display-p3 ${formattedR} ${formattedG} ${formattedB})`);
}

/**
 * Formats DTCG token color object to sRGB CSS string format.
 *
 * @param dtcgColor - DTCG token color object with srgb colorSpace
 * @returns Result containing CSS rgb() string or error message
 */
function formatDTCGColorToRGB(dtcgColor: DTCGColorValue): Result<string> {
    if (dtcgColor.colorSpace !== "srgb") {
        return error(`Expected srgb color space, got: ${dtcgColor.colorSpace}`);
    }

    const errors = validateDTCGColorValue(dtcgColor);
    if (errors.length > 0) {
        return error(`Invalid DTCG color value: ${errors.join(", ")}`);
    }

    const [r, g, b] = dtcgColor.components;
    const alpha = dtcgColor.alpha;

    const r255 = r === "none" ? "none" : Math.round(r * 255);
    const g255 = g === "none" ? "none" : Math.round(g * 255);
    const b255 = b === "none" ? "none" : Math.round(b * 255);

    if (alpha !== undefined && alpha !== 1) {
        const roundedAlpha = Number(alpha.toFixed(4));
        return success(`rgb(${r255} ${g255} ${b255} / ${roundedAlpha})`);
    }

    return success(`rgb(${r255} ${g255} ${b255})`);
}

/**
 * Formats DTCG token color object to HSL CSS string format.
 *
 * @param dtcgColor - DTCG token color object with hsl colorSpace
 * @returns Result containing CSS hsl() string or error message
 */
function formatDTCGColorToHSL(dtcgColor: DTCGColorValue): Result<string> {
    if (dtcgColor.colorSpace !== "hsl") {
        return error(`Expected hsl color space, got: ${dtcgColor.colorSpace}`);
    }

    const errors = validateDTCGColorValue(dtcgColor);
    if (errors.length > 0) {
        return error(`Invalid DTCG color value: ${errors.join(", ")}`);
    }

    const [h, s, l] = dtcgColor.components;
    const alpha = dtcgColor.alpha;

    const formattedH = h === "none" ? "none" : Number(h.toFixed(1));
    const formattedS = s === "none" ? "none" : Math.round(s);
    const formattedL = l === "none" ? "none" : Math.round(l);

    if (alpha !== undefined && alpha !== 1) {
        const roundedAlpha = Number(alpha.toFixed(4));
        const sWithUnit = formattedS === "none" ? "none" : `${formattedS}%`;
        const lWithUnit = formattedL === "none" ? "none" : `${formattedL}%`;
        return success(`hsl(${formattedH} ${sWithUnit} ${lWithUnit} / ${roundedAlpha})`);
    }

    const sWithUnit = formattedS === "none" ? "none" : `${formattedS}%`;
    const lWithUnit = formattedL === "none" ? "none" : `${formattedL}%`;
    return success(`hsl(${formattedH} ${sWithUnit} ${lWithUnit})`);
}
