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

    const pairList = resolvePairList(pairs, Object.keys(multipliers));
    for (const [fromName, toName] of pairList) {
        const fromMultiplier = multipliers[fromName];
        const toMultiplier = multipliers[toName];
        if (fromMultiplier === undefined || toMultiplier === undefined) continue;
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

    return result;
}

function resolvePairList(
    pairs: MultiplierScaleConfig["pairs"],
    names: string[]
): [string, string][] {
    if (pairs === undefined) return [];

    if (pairs === "adjacent") {
        const result: [string, string][] = [];
        for (let i = 0; i < names.length - 1; i++) {
            const from = names[i];
            const to = names[i + 1];
            if (from && to) result.push([from, to]);
        }
        return result;
    }

    return pairs.map((spec) => {
        const dash = spec.indexOf("-");
        return [spec.slice(0, dash), spec.slice(dash + 1)] as [string, string];
    });
}

function roundTo(value: number, precision: number): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
}
