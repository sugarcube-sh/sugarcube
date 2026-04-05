/**
 * Maps token names to their default scale step keys in DEFAULT_SCALES.
 * Used to determine which swatch to highlight/focus when no custom value is set.
 */
import type { ColorSelection } from "../components/ColorGrid";
import { DEFAULT_SCALES, type Palette, type ScaleStep } from "./palettes";

type Mode = "light" | "dark";

const TOKEN_TO_SCALE_KEY: Record<string, string> = {
    // Surfaces
    "surface-default": "surfaceDefault",
    "surface-raised": "surfaceRaised",
    "surface-lowered": "surfaceLowered",
    "surface-lowest": "surfaceLowest",
    // Text
    "text-normal": "textNormal",
    "text-quiet": "textQuiet",
    "text-link": "textLink",
    // Fills
    "fill-quiet": "fillQuiet",
    "fill-normal": "fillNormal",
    "fill-loud": "fillLoud",
    // On-fills
    "on-quiet": "onQuiet",
    "on-normal": "onNormal",
    "on-loud": "onLoud",
    // Border colors
    "border-quiet": "borderQuiet",
    "border-normal": "borderNormal",
    "border-loud": "borderLoud",
};

export function getDefaultColorSelection(
    tokenName: string,
    basePalette: Palette,
    mode: Mode
): ColorSelection | undefined {
    const scaleKey = TOKEN_TO_SCALE_KEY[tokenName];
    if (!scaleKey) return undefined;

    const scales = DEFAULT_SCALES[mode].neutral;
    const step = (scales as Record<string, string>)[scaleKey];
    if (!step) return undefined;

    if (step === "white") return { type: "white" };
    if (step === "black") return { type: "black" };

    return { type: "palette", palette: basePalette, step: step as ScaleStep };
}
