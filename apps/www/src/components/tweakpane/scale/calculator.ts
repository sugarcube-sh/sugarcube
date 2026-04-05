/**
 * Scale calculator — pure functions for generating type and space scales.
 * Used by the tweakpane at runtime. Will later be shared with the build pipeline.
 */

type DimensionValue = {
    value: number;
    unit: "rem" | "px";
};

type ViewportConfig = {
    min: number; // px
    max: number; // px
};

export type GeneratedStep = {
    name: string;
    min: DimensionValue;
    max: DimensionValue;
    clamp: string;
};

export type ExponentialScaleConfig = {
    mode: "exponential";
    viewport: ViewportConfig;
    base: { min: DimensionValue; max: DimensionValue };
    ratio: { min: number; max: number };
    steps: { negative: number; positive: number };
};

export type MultiplierScaleConfig = {
    mode: "multipliers";
    viewport: ViewportConfig;
    base: { min: DimensionValue; max: DimensionValue };
    multipliers: Record<string, number>;
    pairs?: boolean;
};

export type ScaleConfig = ExponentialScaleConfig | MultiplierScaleConfig;

function roundTo(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/**
 * Generate a CSS clamp() value from min/max dimensions and viewport range.
 * Returns a plain value (no clamp) if min === max.
 */
function toClamp(min: DimensionValue, max: DimensionValue, viewport: ViewportConfig): string {
    const rootSize = 16;

    const minPx = min.unit === "rem" ? min.value * rootSize : min.value;
    const maxPx = max.unit === "rem" ? max.value * rootSize : max.value;

    if (Math.abs(minPx - maxPx) < 0.01) {
        return `${roundTo(minPx / rootSize, 4)}rem`;
    }

    const minRem = minPx / rootSize;
    const maxRem = maxPx / rootSize;
    const minVwRem = viewport.min / rootSize;
    const maxVwRem = viewport.max / rootSize;

    const slope = (maxRem - minRem) / (maxVwRem - minVwRem);
    const intersection = minRem - slope * minVwRem;

    return `clamp(${roundTo(minRem, 4)}rem, ${roundTo(intersection, 4)}rem + ${roundTo(slope * 100, 4)}vw, ${roundTo(maxRem, 4)}rem)`;
}

/**
 * Calculate an exponential type scale.
 * Each step: base × ratio^n
 */
export function calculateExponentialScale(config: ExponentialScaleConfig): GeneratedStep[] {
    const { base, ratio, steps: stepConfig, viewport } = config;
    const results: GeneratedStep[] = [];

    for (let i = -stepConfig.negative; i <= stepConfig.positive; i++) {
        const min: DimensionValue = {
            value: roundTo(base.min.value * ratio.min ** i, 4),
            unit: base.min.unit,
        };
        const max: DimensionValue = {
            value: roundTo(base.max.value * ratio.max ** i, 4),
            unit: base.max.unit,
        };

        results.push({
            name: String(i),
            min,
            max,
            clamp: toClamp(min, max, viewport),
        });
    }

    return results;
}

/**
 * Calculate a multiplier-based space scale.
 * Each step: base × multiplier
 */
export function calculateMultiplierScale(config: MultiplierScaleConfig): GeneratedStep[] {
    const { base, multipliers, pairs, viewport } = config;
    const results: GeneratedStep[] = [];

    const entries = Object.entries(multipliers);

    // Base steps
    for (const [name, multiplier] of entries) {
        const min: DimensionValue = {
            value: roundTo(base.min.value * multiplier, 4),
            unit: base.min.unit,
        };
        const max: DimensionValue = {
            value: roundTo(base.max.value * multiplier, 4),
            unit: base.max.unit,
        };

        results.push({
            name,
            min,
            max,
            clamp: toClamp(min, max, viewport),
        });
    }

    // Pairs: min of lower step → max of upper step
    if (pairs) {
        for (let i = 0; i < entries.length - 1; i++) {
            const [fromName, fromMultiplier] = entries[i];
            const [toName, toMultiplier] = entries[i + 1];

            const min: DimensionValue = {
                value: roundTo(base.min.value * fromMultiplier, 4),
                unit: base.min.unit,
            };
            const max: DimensionValue = {
                value: roundTo(base.max.value * toMultiplier, 4),
                unit: base.max.unit,
            };

            results.push({
                name: `${fromName}-${toName}`,
                min,
                max,
                clamp: toClamp(min, max, viewport),
            });
        }
    }

    return results;
}

/**
 * Calculate a scale from config (dispatches to the right mode).
 */
export function calculateScale(config: ScaleConfig): GeneratedStep[] {
    if (config.mode === "exponential") {
        return calculateExponentialScale(config);
    }
    return calculateMultiplierScale(config);
}
