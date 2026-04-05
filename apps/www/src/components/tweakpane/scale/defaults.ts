/**
 * Default scale configurations matching the current fluid starter kit values.
 */
import type { ExponentialScaleConfig, MultiplierScaleConfig } from "./calculator";

export const DEFAULT_VIEWPORT = { min: 320, max: 1440 };

export const DEFAULT_TYPE_SCALE: ExponentialScaleConfig = {
    mode: "exponential",
    viewport: DEFAULT_VIEWPORT,
    base: {
        min: { value: 0.95, unit: "rem" },
        max: { value: 1, unit: "rem" },
    },
    ratio: { min: 1.2, max: 1.25 },
    steps: { negative: 2, positive: 10 },
};

export const DEFAULT_SPACE_SCALE: MultiplierScaleConfig = {
    mode: "multipliers",
    viewport: DEFAULT_VIEWPORT,
    base: {
        min: { value: 0.875, unit: "rem" },
        max: { value: 1, unit: "rem" },
    },
    multipliers: {
        "3xs": 0.25,
        "2xs": 0.5,
        xs: 0.75,
        sm: 1,
        md: 1.5,
        lg: 2,
        xl: 3,
        "2xl": 4,
        "3xl": 6,
    },
    pairs: true,
};

/**
 * Named ratio presets for the type scale.
 */
export const RATIO_PRESETS = {
    "Minor Second": 1.067,
    "Major Second": 1.125,
    "Minor Third": 1.2,
    "Major Third": 1.25,
    "Perfect Fourth": 1.333,
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: intentional typographic scale ratio, not an approximation of Math.SQRT2
    "Augmented Fourth": 1.414,
    "Perfect Fifth": 1.5,
    "Golden Ratio": 1.618,
} as const;

export type RatioPresetName = keyof typeof RATIO_PRESETS;
