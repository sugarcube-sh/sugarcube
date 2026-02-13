import type { Result } from "../types/result.js";
import { error, success } from "../types/result.js";
import type { DTCGColorSpace, DTCGColorValue } from "../types/dtcg-color.js";

export function isDTCGColorValue(value: unknown): value is DTCGColorValue {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const obj = value as Record<string, unknown>;

    if (typeof obj.colorSpace !== "string") {
        return false;
    }

    const supportedColorSpaces: DTCGColorSpace[] = ["oklch", "display-p3", "srgb", "hsl"];
    if (!supportedColorSpaces.includes(obj.colorSpace as DTCGColorSpace)) {
        return false;
    }

    if (!Array.isArray(obj.components) || obj.components.length !== 3) {
        return false;
    }

    if (
        !obj.components.every((component) => typeof component === "number" || component === "none")
    ) {
        return false;
    }

    if (obj.alpha !== undefined && typeof obj.alpha !== "number") {
        return false;
    }

    if (obj.hex !== undefined && typeof obj.hex !== "string") {
        return false;
    }

    return true;
}

export function validateDTCGColorValue(value: DTCGColorValue): string[] {
    const errors: string[] = [];

    const supportedColorSpaces: DTCGColorSpace[] = ["oklch", "display-p3", "srgb", "hsl"];
    if (!supportedColorSpaces.includes(value.colorSpace)) {
        errors.push(
            `Unsupported colorSpace: "${value.colorSpace}". Supported color spaces: ${supportedColorSpaces.join(", ")}.`
        );
    }

    if (!Array.isArray(value.components) || value.components.length !== 3) {
        errors.push("Components must be an array of exactly 3 numbers.");
    } else {
        value.components.forEach((component, index) => {
            if (
                component !== "none" &&
                (typeof component !== "number" || !Number.isFinite(component))
            ) {
                errors.push(`Component ${index} must be a finite number or "none".`);
            }
        });

        if (value.colorSpace === "oklch") {
            const [l, c, h] = value.components;
            if (l !== "none" && (l < 0 || l > 1)) {
                errors.push("OKLCH Lightness (L) must be between 0 and 1 or 'none'.");
            }
            if (c !== "none" && c < 0) {
                errors.push("OKLCH Chroma (C) must be >= 0 or 'none'.");
            }
            if (h !== "none" && (h < 0 || h >= 360)) {
                errors.push("OKLCH Hue (H) must be between 0 and 360 (exclusive) or 'none'.");
            }
        } else if (value.colorSpace === "display-p3") {
            const [r, g, b] = value.components;
            if (r !== "none" && (r < 0 || r > 1)) {
                errors.push("Display P3 Red component must be between 0 and 1 or 'none'.");
            }
            if (g !== "none" && (g < 0 || g > 1)) {
                errors.push("Display P3 Green component must be between 0 and 1 or 'none'.");
            }
            if (b !== "none" && (b < 0 || b > 1)) {
                errors.push("Display P3 Blue component must be between 0 and 1 or 'none'.");
            }
        } else if (value.colorSpace === "srgb") {
            const [r, g, b] = value.components;
            if (r !== "none" && (r < 0 || r > 1)) {
                errors.push("sRGB Red component must be between 0 and 1 or 'none'.");
            }
            if (g !== "none" && (g < 0 || g > 1)) {
                errors.push("sRGB Green component must be between 0 and 1 or 'none'.");
            }
            if (b !== "none" && (b < 0 || b > 1)) {
                errors.push("sRGB Blue component must be between 0 and 1 or 'none'.");
            }
        } else if (value.colorSpace === "hsl") {
            const [h, s, l] = value.components;
            if (h !== "none" && (h < 0 || h >= 360)) {
                errors.push("HSL Hue must be between 0 and 360 (exclusive) or 'none'.");
            }
            if (s !== "none" && (s < 0 || s > 100)) {
                errors.push("HSL Saturation must be between 0 and 100 or 'none'.");
            }
            if (l !== "none" && (l < 0 || l > 100)) {
                errors.push("HSL Lightness must be between 0 and 100 or 'none'.");
            }
        }
    }

    if (value.alpha !== undefined) {
        if (typeof value.alpha !== "number" || !Number.isFinite(value.alpha)) {
            errors.push("Alpha must be a finite number.");
        } else if (value.alpha < 0 || value.alpha > 1) {
            errors.push("Alpha must be between 0 and 1.");
        }
    }

    return errors;
}

function validateDTCGColorValueResult(value: DTCGColorValue): Result<DTCGColorValue> {
    const errors = validateDTCGColorValue(value);
    if (errors.length > 0) {
        return error(errors.join(", "));
    }
    return success(value);
}

export function formatDTCGColorToOKLCH(value: DTCGColorValue): Result<string> {
    const validationResult = validateDTCGColorValueResult(value);
    if (!validationResult.success) {
        return validationResult;
    }

    const [l, c, h] = value.components;
    const alpha = value.alpha;

    const formattedL = l === "none" ? "none" : Number(l.toFixed(4));
    const formattedC = c === "none" ? "none" : Number(c.toFixed(4));
    const formattedH = h === "none" ? "none" : Number(h.toFixed(4));

    if (alpha !== undefined && alpha !== 1) {
        const roundedAlpha = Number(alpha.toFixed(4));
        return success(`oklch(${formattedL} ${formattedC} ${formattedH} / ${roundedAlpha})`);
    }

    return success(`oklch(${formattedL} ${formattedC} ${formattedH})`);
}
