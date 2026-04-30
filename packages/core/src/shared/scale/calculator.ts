/**
 * Pure scale calculator. Given a `ScaleExtension` recipe, returns the
 * concrete steps the recipe describes. No I/O, no pipeline coupling.
 *
 * Exposed as public API (`@sugarcube-sh/core`) so the studio's live preview
 * table and userland tooling can compute steps without re-running the
 * whole resolve pipeline.
 */

import type { Dimension } from "../../types/dtcg.js";
import type {
    ExponentialScaleConfig,
    MultiplierScaleConfig,
    ScaleExtension,
} from "../../types/extensions.js";

export type GeneratedStep = {
    name: string;
    min: Dimension;
    max: Dimension;
};

const ROUND_PRECISION = 4;

export function calculateScale(config: ScaleExtension): GeneratedStep[] {
    return config.mode === "exponential"
        ? calculateExponentialScale(config)
        : calculateMultiplierScale(config);
}

function calculateExponentialScale(config: ExponentialScaleConfig): GeneratedStep[] {
    const { base, ratio, steps } = config;
    const result: GeneratedStep[] = [];

    for (let i = -steps.negative; i <= steps.positive; i++) {
        result.push({
            name: String(i),
            min: {
                value: roundTo(base.min.value * ratio.min ** i, ROUND_PRECISION),
                unit: base.min.unit,
            },
            max: {
                value: roundTo(base.max.value * ratio.max ** i, ROUND_PRECISION),
                unit: base.max.unit,
            },
        });
    }

    return result;
}

function calculateMultiplierScale(config: MultiplierScaleConfig): GeneratedStep[] {
    const { base, multipliers, pairs } = config;
    const result: GeneratedStep[] = [];

    for (const [name, multiplier] of Object.entries(multipliers)) {
        result.push({
            name,
            min: {
                value: roundTo(base.min.value * multiplier, ROUND_PRECISION),
                unit: base.min.unit,
            },
            max: {
                value: roundTo(base.max.value * multiplier, ROUND_PRECISION),
                unit: base.max.unit,
            },
        });
    }

    if (pairs) {
        const entries = Object.entries(multipliers);
        for (let i = 0; i < entries.length - 1; i++) {
            const from = entries[i];
            const to = entries[i + 1];
            if (!from || !to) continue;
            const [fromName, fromMultiplier] = from;
            const [toName, toMultiplier] = to;
            result.push({
                name: `${fromName}-${toName}`,
                min: {
                    value: roundTo(base.min.value * fromMultiplier, ROUND_PRECISION),
                    unit: base.min.unit,
                },
                max: {
                    value: roundTo(base.max.value * toMultiplier, ROUND_PRECISION),
                    unit: base.max.unit,
                },
            });
        }
    }

    return result;
}

function roundTo(value: number, precision: number): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}
